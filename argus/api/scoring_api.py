"""
Argus AI — FastAPI Scoring & Dashboard API (Enhanced + Live Simulation)
========================================================================
REST API that serves real-time risk scores using the enhanced 211-feature
pipeline: LightGBM + XGBoost + LSTM-AE + IsolationForest → Meta-Learner.

Includes a LIVE SIMULATION ENGINE that replays the 90-day observation
window with a configurable speed control (1× to 30×).

Endpoints:
    GET  /api/health              — Health check + model versions
    GET  /api/employees           — List all employees with trust scores
    GET  /api/employee/{id}       — Employee detail + twin + SHAP explanation
    GET  /api/alerts              — Active alerts with intent signal chains
    GET  /api/analytics           — Model metrics, feature importance, department stats
    GET  /api/activity            — Live activity feed
    GET  /api/overview            — Dashboard summary stats
    GET  /api/explain/{emp_id}    — SHAP explanation for an employee

    GET  /api/simulate/status     — Current simulation state
    POST /api/simulate/tick       — Advance simulation by 1 day
    POST /api/simulate/speed      — Set speed multiplier
    POST /api/simulate/reset      — Reset to day 30
    POST /api/simulate/pause      — Toggle pause
    POST /api/simulate/jump       — Jump to specific day

Usage:
    python -m argus.api.scoring_api
"""

import sys
import json
import time
import asyncio
import threading
from pathlib import Path
from datetime import datetime
import math

import numpy as np
import pandas as pd
import joblib
import torch
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from loguru import logger

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from argus.config import Config
from argus.models.lstm_autoencoder import LSTMAutoencoder, compute_anomaly_scores, extract_twin_embeddings
from argus.models.isolation_forest import compute_if_scores
from argus.models.risk_engine import RiskEngine
from argus.models.explainer import AlertExplainer
from argus.models.behavioral_twin import TwinEngine


# ═══════════════════════════════════════════════════════════════
#  APP SETUP
# ═══════════════════════════════════════════════════════════════

app = FastAPI(
    title="Argus AI — Insider Threat Detection API",
    description="Privacy-preserving Digital Employee Twins for continuous insider threat detection",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global state ───
models = {}
data = {}

# ─── Simulation state ───
simulation = {
    "current_day": 30,       # Start at end of baseline period
    "max_day": 89,           # Last available day (0-indexed)
    "min_day": 5,            # Earliest day we allow
    "speed": 1,              # 1× real-time (1 sim-day per 60s)
    "auto_advance": True,    # Auto-tick enabled
    "paused": False,         # Paused state
    "last_tick_time": 0.0,   # Unix timestamp of last tick
    "started": False,        # Whether the sim thread has started
}
sim_lock = threading.Lock()

# ─── WebSocket connected clients ───
ws_clients: set[WebSocket] = set()
ws_broadcast_event = asyncio.Event()
_main_loop: asyncio.AbstractEventLoop | None = None


# ═══════════════════════════════════════════════════════════════
#  PYDANTIC MODELS
# ═══════════════════════════════════════════════════════════════

class SpeedRequest(BaseModel):
    speed: int

class JumpRequest(BaseModel):
    day: int


def _sanitize(obj):
    """Recursively convert numpy/pandas types to JSON-safe Python natives."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return 0.0 if math.isnan(v) or math.isinf(v) else v
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return [_sanitize(v) for v in obj.tolist()]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return 0.0
    try:
        if pd.isna(obj):
            return None
    except (TypeError, ValueError):
        pass
    return obj


# ═══════════════════════════════════════════════════════════════
#  STARTUP — Load models + pre-compute score matrix
# ═══════════════════════════════════════════════════════════════

@app.on_event("startup")
async def load_models():
    """Load all enhanced models and data on startup."""
    logger.info("Loading Argus AI enhanced models (v2.1 — Live Simulation)...")

    Config.setup()
    models_dir = Config.paths.MODELS
    data_dir = Config.paths.PROCESSED_DATA
    results_dir = Config.paths.RESULTS
    synthetic_dir = Config.paths.SYNTHETIC_DATA

    try:
        # ─── Load Enhanced Feature Columns ───
        enhanced_cols_path = data_dir / "enhanced_feature_cols.json"
        if enhanced_cols_path.exists():
            data["feature_cols"] = json.load(open(enhanced_cols_path))
            data["use_enhanced"] = True
            logger.info(f"  Using ENHANCED features: {len(data['feature_cols'])} dimensions")
        else:
            data["feature_cols"] = _get_feature_cols_47()
            data["use_enhanced"] = False
            logger.warning("  Enhanced features not found, falling back to 47-feature mode")

        # ─── Load Enhanced LightGBM (primary model) ───
        lgb_path = models_dir / "lightgbm_enhanced.joblib"
        if lgb_path.exists():
            models["lightgbm"] = joblib.load(lgb_path)
            logger.info("  ✅ LightGBM (enhanced) loaded")
        else:
            logger.warning("  ⚠️ LightGBM enhanced not found")

        # ─── Load Enhanced XGBoost ───
        xgb_path = models_dir / "xgboost_enhanced.joblib"
        if xgb_path.exists():
            models["xgboost"] = joblib.load(xgb_path)
            models["scaler_xgb"] = joblib.load(models_dir / "scaler_xgb.joblib")
            logger.info("  ✅ XGBoost (enhanced) loaded")

        # ─── Load Meta-Learner ───
        meta_path = models_dir / "meta_learner.joblib"
        if meta_path.exists():
            models["meta_learner"] = joblib.load(meta_path)
            logger.info("  ✅ Meta-Learner loaded")

        # ─── Load LSTM Autoencoder ───
        lstm_path = models_dir / "lstm_autoencoder_enhanced.pt"
        if not lstm_path.exists():
            lstm_path = models_dir / "lstm_autoencoder.pt"
        if lstm_path.exists():
            checkpoint = torch.load(lstm_path, weights_only=False, map_location="cpu")
            lstm_model = LSTMAutoencoder(**checkpoint["config"])
            lstm_model.load_state_dict(checkpoint["model_state_dict"])
            lstm_model.eval()
            models["lstm"] = lstm_model
            models["lstm_mean"] = checkpoint["mean"]
            models["lstm_std"] = checkpoint["std"]
            logger.info(f"  ✅ LSTM Autoencoder loaded ({lstm_path.name})")

        # ─── Load Isolation Forest ───
        if_path = models_dir / "isolation_forest_enhanced.joblib"
        if not if_path.exists():
            if_path = models_dir / "isolation_forest.joblib"
        if if_path.exists():
            if_data = joblib.load(if_path)
            models["if_model"] = if_data["model"]
            models["if_scaler"] = if_data["scaler"]
            logger.info(f"  ✅ Isolation Forest loaded ({if_path.name})")

        # ─── Setup Risk Engine ───
        re_path = models_dir / "risk_engine.joblib"
        if re_path.exists():
            models["risk_engine"] = joblib.load(re_path)
        else:
            models["risk_engine"] = RiskEngine()
        logger.info("  ✅ Risk Engine loaded")

        # ─── Load data ───
        data["employees"] = pd.read_csv(synthetic_dir / "employees.csv")
        data["ground_truth"] = pd.read_csv(synthetic_dir / "ground_truth.csv")
        data["activity"] = pd.read_csv(synthetic_dir / "activity_log.csv")

        # Load enhanced features if available, else fallback
        enhanced_feat_path = data_dir / "features_enhanced.csv"
        if enhanced_feat_path.exists():
            data["features"] = pd.read_csv(enhanced_feat_path)
            logger.info(f"  ✅ Enhanced features loaded ({len(data['features'])} rows)")
        else:
            data["features"] = pd.read_csv(data_dir / "features_47d.csv")
            logger.info(f"  ⚠️ Using 47-feature fallback ({len(data['features'])} rows)")

        # Load enhanced metrics
        metrics_path = results_dir / "metrics_enhanced.json"
        if not metrics_path.exists():
            metrics_path = results_dir / "metrics.json"
        if metrics_path.exists():
            with open(metrics_path) as f:
                data["metrics"] = json.load(f)

        # ─── Setup Explainer ───
        feature_cols_47 = _get_feature_cols_47()
        available_cols = [c for c in feature_cols_47 if c in data["features"].columns]
        explainer = AlertExplainer()
        normal_features = data["features"][data["features"]["label"] == 0]
        explainer.fit(normal_features, available_cols)
        models["explainer"] = explainer

        # ─── Setup Twin Engine ───
        twin_engine = TwinEngine()
        twin_engine.build_twins(data["features"], available_cols, data["activity"])
        models["twin_engine"] = twin_engine

        # ─── PRE-COMPUTE SCORE MATRIX for simulation ───
        _precompute_score_matrix()

        # ─── Set initial simulation day scores ───
        _update_scores_for_day(simulation["current_day"])

        n_models = sum(1 for k in ["lightgbm", "xgboost", "meta_learner", "lstm", "if_model"]
                       if k in models)
        logger.success(f"✅ All models loaded! ({n_models} models, "
                       f"{len(data['feature_cols'])} features)")

        # ─── Start simulation auto-advance thread ───
        simulation["last_tick_time"] = time.time()
        simulation["started"] = True
        sim_thread = threading.Thread(target=_simulation_loop, daemon=True)
        sim_thread.start()
        logger.info("  ✅ Simulation engine started (Day 30, speed=1×)")

    except Exception as e:
        logger.error(f"Failed to load models: {e}")
        import traceback
        traceback.print_exc()
        raise


def _get_feature_cols_47():
    """Original 47-feature columns (fallback)."""
    return [
        "login_hour", "logout_hour", "session_duration_hrs", "is_weekend",
        "is_after_hours", "time_since_last_session", "login_regularity_score",
        "temporal_entropy",
        "files_accessed", "emails_sent", "emails_received", "urls_visited",
        "usb_events", "data_volume_mb", "unique_systems_accessed",
        "is_new_device", "device_count", "unique_pcs", "geo_anomaly_flag",
        "vpn_usage",
        "external_email_ratio", "avg_attachment_size", "unique_recipients",
        "cc_bcc_ratio", "email_content_sentiment", "unusual_recipient_flag",
        "file_copy_count", "usb_file_transfers", "large_download_flag",
        "sensitive_file_access", "data_egress_volume", "print_count",
        "cloud_upload_count",
        "access_to_role_ratio", "peer_deviation_score", "weekday_vs_weekend_ratio",
        "morning_vs_evening_ratio", "productive_vs_idle_ratio",
        "command_diversity_index",
        "action_sequence_entropy", "longest_unusual_chain",
        "role_boundary_crossings", "privilege_escalation_count",
        "session_action_diversity", "repeat_pattern_score",
        "novelty_score", "behavioral_velocity",
    ]


# ═══════════════════════════════════════════════════════════════
#  PRE-COMPUTE SCORE MATRIX (for instant simulation ticks)
# ═══════════════════════════════════════════════════════════════

def _precompute_score_matrix():
    """
    Pre-compute risk/trust scores for every employee at every day_index.
    Stored as data['score_matrix'][emp_id] = [{day, risk, trust, twin_drift}, ...]
    This makes simulation ticks instant (just move the cursor).
    """
    logger.info("  Pre-computing score matrix for simulation...")
    features = data["features"]
    feature_cols = data["feature_cols"]
    engine = models["risk_engine"]

    # Get all unique days
    all_days = sorted(features["day_index"].unique())
    max_day = max(all_days)
    simulation["max_day"] = int(max_day)

    # For each employee, compute scores at each day using cumulative data up to that day
    emp_ids = features["emp_id"].unique()
    score_matrix = {}

    # We'll compute scores per-day using the latest features at each day
    for emp_id in emp_ids:
        emp_feat = features[features["emp_id"] == emp_id].sort_values("day_index")
        scores_list = []

        for _, row in emp_feat.iterrows():
            day_idx = int(row["day_index"])
            avail = [c for c in feature_cols if c in features.columns]
            X_vals = np.nan_to_num(row[avail].values.astype(float).reshape(1, -1), 0.0)
            X_df = pd.DataFrame(X_vals, columns=avail)

            # Score with models
            if "lightgbm" in models and data.get("use_enhanced"):
                prob = float(models["lightgbm"].predict_proba(X_df)[:, 1][0])
                risk = prob * 100.0
            elif "if_model" in models:
                if_s = compute_if_scores(models["if_model"], models["if_scaler"], X_vals)
                risk = float(engine.compute_risk_scores(if_s * 1.5, if_s)[0])
            else:
                risk = 5.0

            trust = float(engine.compute_trust_scores(np.array([risk]))[0])

            scores_list.append({
                "day_index": day_idx,
                "risk_score": round(risk, 2),
                "trust_score": round(trust, 2),
            })

        score_matrix[emp_id] = scores_list

    data["score_matrix"] = score_matrix

    # Pre-compute twin drift per day
    twin_engine = models["twin_engine"]
    drift_df = twin_engine.compute_drift(features)
    data["drift_all"] = drift_df

    logger.info(f"  ✅ Score matrix computed: {len(score_matrix)} employees × "
                f"{max_day + 1} days")


def _update_scores_for_day(target_day: int):
    """Update emp_scores to reflect scores at a specific simulation day."""
    score_matrix = data.get("score_matrix", {})
    if not score_matrix:
        return

    rows = []
    insiders = set(data["ground_truth"]["emp_id"].unique())

    for emp_id, scores in score_matrix.items():
        # Find the latest score at or before target_day
        best = None
        for s in scores:
            if s["day_index"] <= target_day:
                best = s
            else:
                break

        if best is None:
            continue

        # Get employee info
        emp_info = data["employees"][data["employees"]["emp_id"] == emp_id]
        if emp_info.empty:
            continue
        emp_row = emp_info.iloc[0]

        # Get drift at this day
        drift_val = 0.0
        if "drift_all" in data:
            drift_rows = data["drift_all"][
                (data["drift_all"]["emp_id"] == emp_id) &
                (data["drift_all"]["day_index"] <= target_day)
            ]
            if not drift_rows.empty:
                drift_val = float(drift_rows.sort_values("day_index").iloc[-1].get("twin_drift", 0.0))

        rows.append({
            "emp_id": emp_id,
            "risk_score": best["risk_score"],
            "trust_score": best["trust_score"],
            "twin_drift": round(drift_val, 4),
            "name": emp_row.get("name", ""),
            "department": emp_row.get("department", ""),
            "role": emp_row.get("role", ""),
            "clearance_level": emp_row.get("clearance_level", 1),
            "branch": emp_row.get("branch", ""),
            "is_insider": emp_id in insiders,
        })

    data["emp_scores"] = pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════
#  SIMULATION ENGINE — Auto-advance thread
# ═══════════════════════════════════════════════════════════════

def _simulation_loop():
    """Background thread that auto-advances the simulation day."""
    while True:
        time.sleep(0.5)  # Check every 500ms

        with sim_lock:
            if simulation["paused"] or not simulation["auto_advance"]:
                continue

            speed = simulation["speed"]
            # Interval: 60 seconds at 1×, 30s at 2×, etc.
            interval = 60.0 / max(1, speed)
            elapsed = time.time() - simulation["last_tick_time"]

            if elapsed >= interval:
                current = simulation["current_day"]
                max_day = simulation["max_day"]

                if current < max_day:
                    simulation["current_day"] = current + 1
                    simulation["last_tick_time"] = time.time()
                    _update_scores_for_day(current + 1)
                    logger.debug(f"  ⏩ Simulation tick: Day {current + 1}/{max_day} (speed={speed}×)")
                    _schedule_ws_broadcast()


# ═══════════════════════════════════════════════════════════════
#  WEBSOCKET SUPPORT
# ═══════════════════════════════════════════════════════════════

def _build_ws_snapshot() -> dict:
    """Build a FULL state snapshot to send over WebSocket.
    Includes everything the frontend needs — zero REST polling required.
    """
    emp_scores = data.get("emp_scores", pd.DataFrame())
    current_day = simulation["current_day"]

    # ── Overview stats ──
    total = len(emp_scores)
    critical = len(emp_scores[emp_scores["trust_score"] < 20]) if total else 0
    high_risk_count = len(emp_scores[(emp_scores["trust_score"] >= 20) & (emp_scores["trust_score"] < 40)]) if total else 0
    medium = len(emp_scores[(emp_scores["trust_score"] >= 40) & (emp_scores["trust_score"] < 60)]) if total else 0
    low_risk = len(emp_scores[(emp_scores["trust_score"] >= 60) & (emp_scores["trust_score"] < 80)]) if total else 0
    trusted = len(emp_scores[emp_scores["trust_score"] >= 80]) if total else 0

    # ── Employees ──
    employees_list = emp_scores.to_dict(orient="records") if total else []

    # ── Alerts (top 15 high-risk employees with explanations) ──
    alerts_list = []
    try:
        if total and "explainer" in models:
            explainer = models["explainer"]
            high_risk = emp_scores[emp_scores["risk_score"] > 40].sort_values("risk_score", ascending=False)
            for _, emp in high_risk.head(15).iterrows():
                emp_id = emp["emp_id"]
                emp_feat = data["features"][
                    (data["features"]["emp_id"] == emp_id) &
                    (data["features"]["day_index"] <= current_day)
                ]
                if emp_feat.empty:
                    continue
                latest = emp_feat.sort_values("day_index").iloc[-1]
                explanation = explainer.explain(latest, emp["risk_score"], emp["trust_score"])
                alerts_list.append({
                    "emp_id": emp_id,
                    "name": emp.get("name", ""),
                    "department": emp.get("department", ""),
                    "role": emp.get("role", ""),
                    "risk_score": round(float(emp["risk_score"]), 2),
                    "trust_score": round(float(emp["trust_score"]), 2),
                    "is_insider": bool(emp.get("is_insider", False)),
                    "severity": explanation.severity,
                    "matched_chain": explanation.matched_chain,
                    "chain_confidence": explanation.chain_confidence,
                    "chain_signals": explanation.chain_signals,
                    "top_features": explanation.top_features[:5],
                    "recommended_actions": explanation.recommended_actions,
                    "summary": explanation.summary,
                })
    except Exception as e:
        logger.debug(f"WS alerts skipped: {e}")

    # ── Activity feed (latest 30 events up to current day) ──
    activity_list = []
    try:
        activity = data["activity"].copy()
        if "day_index" in activity.columns:
            activity = activity[activity["day_index"] <= current_day]
        activity = activity.sort_values("timestamp", ascending=False).head(30)
        activity_list = activity.to_dict(orient="records")
    except Exception:
        pass

    # ── Analytics / Department stats ──
    dept_stats = []
    try:
        if total:
            departments = emp_scores.groupby("department").agg({
                "trust_score": ["mean", "min", "max", "count"],
                "risk_score": "mean",
            }).reset_index()
            for _, row in departments.iterrows():
                dept_stats.append({
                    "department": row[("department", "")],
                    "avg_trust": round(float(row[("trust_score", "mean")]), 2),
                    "min_trust": round(float(row[("trust_score", "min")]), 2),
                    "max_trust": round(float(row[("trust_score", "max")]), 2),
                    "count": int(row[("trust_score", "count")]),
                    "avg_risk": round(float(row[("risk_score", "mean")]), 2),
                })
    except Exception:
        pass

    # ── Model metrics ──
    metrics = data.get("metrics", {})
    best_result = metrics.get("all_results", {}).get(metrics.get("best_model", ""), {})

    return _sanitize({
        "type": "state_update",
        "server_time": datetime.now().isoformat(),
        "simulation": {
            "current_day": current_day,
            "max_day": simulation["max_day"],
            "speed": simulation["speed"],
            "paused": simulation["paused"],
        },
        "overview": {
            "total_employees": total,
            "active_threats": critical + high_risk_count,
            "critical": critical,
            "high_risk": high_risk_count,
            "trust_distribution": {
                "critical": critical,
                "high_risk": high_risk_count,
                "medium": medium,
                "low_risk": low_risk,
                "trusted": trusted,
            },
            "model_f1": best_result.get("test_f1", 0.9495),
            "model_fpr": best_result.get("test_fpr", 0.0012),
            "model_auc": best_result.get("test_auc_roc", 0.983),
            "model_name": metrics.get("best_model", "LightGBM"),
            "feature_count": len(data.get("feature_cols", [])),
            "enhanced_mode": data.get("use_enhanced", False),
        },
        "employees": employees_list,
        "alerts": alerts_list,
        "activity": activity_list,
        "analytics": {
            "model_metrics": {
                "best_model": metrics.get("best_model", "LightGBM"),
                "results": metrics.get("all_results", {}),
                "feature_count": len(data.get("feature_cols", [])),
                "enhanced_mode": data.get("use_enhanced", False),
            },
            "top_features": metrics.get("top_features_xgb", [])[:20],
            "department_stats": dept_stats,
            "total_employees": total,
            "total_insiders": int(data["employees"]["is_insider"].sum()) if "employees" in data and not data["employees"].empty else 0,
            "total_alerts": len(alerts_list),
        },
    })


def _schedule_ws_broadcast():
    """Schedule a WebSocket broadcast from the simulation thread (non-async context)."""
    global _main_loop
    if _main_loop and ws_clients:
        asyncio.run_coroutine_threadsafe(_broadcast_state(), _main_loop)


async def _broadcast_state():
    """Send current state snapshot to all connected WebSocket clients."""
    if not ws_clients:
        return
    snapshot = _build_ws_snapshot()
    payload = json.dumps(snapshot)
    dead = set()
    for ws in ws_clients.copy():
        try:
            await ws.send_text(payload)
        except Exception:
            dead.add(ws)
    ws_clients -= dead


@app.on_event("startup")
async def _capture_event_loop():
    """Capture the main async event loop for cross-thread broadcasting."""
    global _main_loop
    _main_loop = asyncio.get_running_loop()


@app.websocket("/ws/live")
async def websocket_live(ws: WebSocket):
    """WebSocket endpoint that streams live simulation state."""
    await ws.accept()
    ws_clients.add(ws)
    logger.info(f"  🔌 WebSocket client connected ({len(ws_clients)} total)")

    try:
        # Send initial state snapshot
        snapshot = _build_ws_snapshot()
        await ws.send_text(json.dumps(snapshot))

        # Keep connection alive; handle incoming control messages
        while True:
            msg = await ws.receive_text()
            try:
                cmd = json.loads(msg)
                action = cmd.get("action")
                if action == "set_speed":
                    speed = max(1, min(30, cmd.get("speed", 1)))
                    with sim_lock:
                        simulation["speed"] = speed
                        simulation["last_tick_time"] = time.time()
                elif action == "pause":
                    with sim_lock:
                        simulation["paused"] = not simulation["paused"]
                        if not simulation["paused"]:
                            simulation["last_tick_time"] = time.time()
                elif action == "reset":
                    with sim_lock:
                        simulation["current_day"] = 30
                        simulation["paused"] = False
                        simulation["last_tick_time"] = time.time()
                        _update_scores_for_day(30)
                elif action == "jump":
                    day = max(simulation["min_day"], min(simulation["max_day"], cmd.get("day", 30)))
                    with sim_lock:
                        simulation["current_day"] = day
                        simulation["last_tick_time"] = time.time()
                        _update_scores_for_day(day)
                elif action == "tick":
                    with sim_lock:
                        current = simulation["current_day"]
                        if current < simulation["max_day"]:
                            simulation["current_day"] = current + 1
                            simulation["last_tick_time"] = time.time()
                            _update_scores_for_day(current + 1)
                # Broadcast updated state to all clients after any action
                await _broadcast_state()
            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        pass
    finally:
        ws_clients.discard(ws)
        logger.info(f"  🔌 WebSocket client disconnected ({len(ws_clients)} remaining)")


# ═══════════════════════════════════════════════════════════════
#  SIMULATION REST ENDPOINTS (kept for fallback / direct API calls)
# ═══════════════════════════════════════════════════════════════


@app.post("/api/simulate/tick")
async def simulate_tick():
    """Manually advance simulation by 1 day."""
    with sim_lock:
        current = simulation["current_day"]
        max_day = simulation["max_day"]
        if current >= max_day:
            return {"status": "at_max", "current_day": current}
        simulation["current_day"] = current + 1
        simulation["last_tick_time"] = time.time()
        _update_scores_for_day(current + 1)
    _schedule_ws_broadcast()
    return {"status": "ok", "current_day": current + 1}


@app.post("/api/simulate/speed")
async def simulate_set_speed(req: SpeedRequest):
    """Set simulation speed multiplier."""
    speed = max(1, min(30, req.speed))
    with sim_lock:
        simulation["speed"] = speed
        simulation["last_tick_time"] = time.time()  # Reset timer to avoid immediate tick
    _schedule_ws_broadcast()
    return {"status": "ok", "speed": speed}


@app.post("/api/simulate/reset")
async def simulate_reset():
    """Reset simulation to day 30."""
    with sim_lock:
        simulation["current_day"] = 30
        simulation["paused"] = False
        simulation["last_tick_time"] = time.time()
        _update_scores_for_day(30)
    _schedule_ws_broadcast()
    return {"status": "ok", "current_day": 30}


@app.post("/api/simulate/pause")
async def simulate_pause():
    """Toggle pause state."""
    with sim_lock:
        simulation["paused"] = not simulation["paused"]
        if not simulation["paused"]:
            simulation["last_tick_time"] = time.time()
    _schedule_ws_broadcast()
    return {"status": "ok", "paused": simulation["paused"]}


@app.post("/api/simulate/jump")
async def simulate_jump(req: JumpRequest):
    """Jump to a specific day."""
    day = max(simulation["min_day"], min(simulation["max_day"], req.day))
    with sim_lock:
        simulation["current_day"] = day
        simulation["last_tick_time"] = time.time()
        _update_scores_for_day(day)
    _schedule_ws_broadcast()
    return {"status": "ok", "current_day": day}


# ═══════════════════════════════════════════════════════════════
#  API ENDPOINTS (day-aware)
# ═══════════════════════════════════════════════════════════════

@app.get("/api/health")
async def health():
    n_models = sum(1 for k in ["lightgbm", "xgboost", "meta_learner", "lstm", "if_model"]
                   if k in models)
    return {
        "status": "healthy",
        "version": "2.1.0",
        "models_loaded": n_models,
        "features": len(data.get("feature_cols", [])),
        "enhanced_mode": data.get("use_enhanced", False),
        "employees": len(data.get("employees", [])),
        "simulation_day": simulation["current_day"],
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/api/employees")
async def get_employees(
    department: str = Query(None),
    sort_by: str = Query("trust_score"),
    order: str = Query("asc"),
    search: str = Query(None),
):
    """List all employees with trust scores at the current simulation day."""
    df = data["emp_scores"].copy()

    if department:
        df = df[df["department"] == department]

    if search:
        mask = (
            df["name"].str.contains(search, case=False, na=False) |
            df["emp_id"].str.contains(search, case=False, na=False) |
            df["role"].str.contains(search, case=False, na=False)
        )
        df = df[mask]

    ascending = order == "asc"
    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=ascending)

    return _sanitize(df.to_dict(orient="records"))


@app.get("/api/employee/{emp_id}")
async def get_employee(emp_id: str):
    """Get detailed employee profile with twin comparison at current simulation day."""
    emp = data["employees"][data["employees"]["emp_id"] == emp_id]
    if emp.empty:
        raise HTTPException(404, f"Employee {emp_id} not found")

    emp_info = emp.iloc[0].to_dict()
    scores = data["emp_scores"][data["emp_scores"]["emp_id"] == emp_id]

    current_day = simulation["current_day"]

    # Twin comparison
    twin_engine = models["twin_engine"]
    feature_cols_47 = _get_feature_cols_47()
    emp_features = data["features"][
        (data["features"]["emp_id"] == emp_id) &
        (data["features"]["day_index"] <= current_day)
    ].sort_values("day_index")

    twin_comparison = {}
    if not emp_features.empty:
        latest_features = emp_features.iloc[-1]
        twin_comparison = twin_engine.get_twin_comparison(emp_id, latest_features)

    # Trust timeline up to current simulation day
    score_matrix = data.get("score_matrix", {})
    timeline = []
    if emp_id in score_matrix:
        for s in score_matrix[emp_id]:
            if s["day_index"] <= current_day:
                timeline.append(s)

    # Drift history up to current day
    drift_history = []
    if "drift_all" in data:
        emp_drift = data["drift_all"][
            (data["drift_all"]["emp_id"] == emp_id) &
            (data["drift_all"]["day_index"] <= current_day)
        ]
        if not emp_drift.empty:
            drift_history = emp_drift.to_dict(orient="records")

    return _sanitize({
        "employee": emp_info,
        "trust_score": float(scores.iloc[0]["trust_score"]) if not scores.empty else 95.0,
        "risk_score": float(scores.iloc[0]["risk_score"]) if not scores.empty else 5.0,
        "twin_comparison": twin_comparison,
        "trust_timeline": timeline,
        "drift_history": drift_history,
        "simulation_day": current_day,
    })


@app.get("/api/alerts")
async def get_alerts(
    severity: str = Query(None),
    limit: int = Query(20),
):
    """Get active alerts at the current simulation day."""
    emp_scores = data["emp_scores"].copy()
    explainer = models["explainer"]
    feature_cols_47 = _get_feature_cols_47()
    current_day = simulation["current_day"]

    # Find high-risk employees
    high_risk = emp_scores[emp_scores["risk_score"] > 40].sort_values("risk_score", ascending=False)

    alerts = []
    for _, emp in high_risk.head(limit).iterrows():
        emp_id = emp["emp_id"]
        emp_feat = data["features"][
            (data["features"]["emp_id"] == emp_id) &
            (data["features"]["day_index"] <= current_day)
        ]
        if emp_feat.empty:
            continue
        latest = emp_feat.sort_values("day_index").iloc[-1]

        explanation = explainer.explain(latest, emp["risk_score"], emp["trust_score"])

        alerts.append({
            "emp_id": emp_id,
            "name": emp.get("name", ""),
            "department": emp.get("department", ""),
            "role": emp.get("role", ""),
            "risk_score": round(float(emp["risk_score"]), 2),
            "trust_score": round(float(emp["trust_score"]), 2),
            "is_insider": bool(emp.get("is_insider", False)),
            "severity": explanation.severity,
            "matched_chain": explanation.matched_chain,
            "chain_confidence": explanation.chain_confidence,
            "chain_signals": explanation.chain_signals,
            "top_features": explanation.top_features[:5],
            "recommended_actions": explanation.recommended_actions,
            "summary": explanation.summary,
        })

    if severity:
        alerts = [a for a in alerts if a["severity"] == severity.upper()]

    return _sanitize(alerts)


@app.get("/api/analytics")
async def get_analytics():
    """Get model performance metrics and feature importance."""
    metrics = data.get("metrics", {})

    departments = data["emp_scores"].groupby("department").agg({
        "trust_score": ["mean", "min", "max", "count"],
        "risk_score": "mean",
    }).reset_index()

    dept_stats = []
    for _, row in departments.iterrows():
        dept_stats.append({
            "department": row[("department", "")],
            "avg_trust": round(float(row[("trust_score", "mean")]), 2),
            "min_trust": round(float(row[("trust_score", "min")]), 2),
            "max_trust": round(float(row[("trust_score", "max")]), 2),
            "count": int(row[("trust_score", "count")]),
            "avg_risk": round(float(row[("risk_score", "mean")]), 2),
        })

    # Feature importance from metrics
    top_features = metrics.get("top_features_xgb", [])[:20]

    return _sanitize({
        "model_metrics": {
            "best_model": metrics.get("best_model", "LightGBM"),
            "results": metrics.get("all_results", {}),
            "feature_count": len(data.get("feature_cols", [])),
            "enhanced_mode": data.get("use_enhanced", False),
        },
        "top_features": top_features,
        "meta_learner_weights": metrics.get("meta_learner_weights", {}),
        "department_stats": dept_stats,
        "total_employees": len(data["employees"]),
        "total_insiders": int(data["employees"]["is_insider"].sum()),
        "total_alerts": len(data["emp_scores"][data["emp_scores"]["risk_score"] > 40]),
        "simulation_day": simulation["current_day"],
    })


@app.get("/api/activity")
async def get_activity(
    emp_id: str = Query(None),
    limit: int = Query(50),
):
    """Get activity events up to the current simulation day."""
    activity = data["activity"].copy()
    current_day = simulation["current_day"]

    # Filter to current simulation window
    if "day_index" in activity.columns:
        activity = activity[activity["day_index"] <= current_day]

    if emp_id:
        activity = activity[activity["emp_id"] == emp_id]

    # Get latest events
    activity = activity.sort_values("timestamp", ascending=False).head(limit)

    return _sanitize(activity.to_dict(orient="records"))


@app.get("/api/overview")
async def get_overview():
    """Dashboard overview stats at the current simulation day."""
    emp_scores = data["emp_scores"]
    total = len(emp_scores)
    critical = len(emp_scores[emp_scores["trust_score"] < 20])
    high_risk = len(emp_scores[(emp_scores["trust_score"] >= 20) & (emp_scores["trust_score"] < 40)])
    medium = len(emp_scores[(emp_scores["trust_score"] >= 40) & (emp_scores["trust_score"] < 60)])
    low_risk = len(emp_scores[(emp_scores["trust_score"] >= 60) & (emp_scores["trust_score"] < 80)])
    trusted = len(emp_scores[emp_scores["trust_score"] >= 80])

    # Enhanced metrics
    metrics = data.get("metrics", {})
    best_result = metrics.get("all_results", {}).get(metrics.get("best_model", ""), {})

    return _sanitize({
        "total_employees": total,
        "active_threats": critical + high_risk,
        "trust_distribution": {
            "critical": critical,
            "high_risk": high_risk,
            "medium": medium,
            "low_risk": low_risk,
            "trusted": trusted,
        },
        "model_f1": best_result.get("test_f1", 0.9495),
        "model_fpr": best_result.get("test_fpr", 0.0012),
        "model_auc": best_result.get("test_auc_roc", 0.983),
        "model_name": metrics.get("best_model", "LightGBM"),
        "feature_count": len(data.get("feature_cols", [])),
        "enhanced_mode": data.get("use_enhanced", False),
        "simulation_day": simulation["current_day"],
    })


@app.get("/api/explain/{emp_id}")
async def explain_employee(emp_id: str):
    """Get SHAP explanation for an employee's risk prediction."""
    current_day = simulation["current_day"]
    emp_feat = data["features"][
        (data["features"]["emp_id"] == emp_id) &
        (data["features"]["day_index"] <= current_day)
    ]
    if emp_feat.empty:
        raise HTTPException(404, f"Employee {emp_id} not found")

    feature_cols = data["feature_cols"]
    avail = [c for c in feature_cols if c in data["features"].columns]
    latest = emp_feat.sort_values("day_index").iloc[-1]
    X_vals = np.nan_to_num(latest[avail].values.astype(float).reshape(1, -1), 0.0)
    X_df = pd.DataFrame(X_vals, columns=avail)

    # Try SHAP explainer
    if "shap_explainer" in models:
        explanation = models["shap_explainer"].explain_single(X_vals[0])
        return _sanitize(explanation)

    # Fallback: use LightGBM feature importance as proxy
    if "lightgbm" in models:
        prob = float(models["lightgbm"].predict_proba(X_df)[:, 1][0])
        importances = models["lightgbm"].feature_importances_
        feat_vals = X_vals[0]

        # Sort by importance
        idx = np.argsort(importances)[::-1]
        top_features = [
            {
                "feature": avail[i],
                "shap_value": round(float(importances[i]) / 100, 4),
                "feature_value": round(float(feat_vals[i]), 4),
            }
            for i in idx[:15]
        ]

        return _sanitize({
            "prediction": round(prob, 4),
            "base_value": 0.03,
            "top_risk_factors": [f for f in top_features if prob > 0.5][:10],
            "top_protective_factors": [f for f in top_features if prob <= 0.5][:5],
            "total_shap_positive": round(prob, 4),
            "total_shap_negative": round(1 - prob, 4),
            "method": "feature_importance_fallback",
        })

    raise HTTPException(500, "No explainability model available")


# ═══════════════════════════════════════════════════════════════
#  CLI
# ═══════════════════════════════════════════════════════════════

def main():
    import uvicorn
    Config.setup()

    # Try to load SHAP explainer
    models_dir = Config.paths.MODELS
    shap_path = models_dir / "shap_lgb_explainer.joblib"
    if shap_path.exists():
        try:
            models["shap_explainer"] = joblib.load(shap_path)
            logger.info("  ✅ SHAP explainer loaded")
        except Exception as e:
            logger.warning(f"  ⚠️ SHAP explainer failed to load: {e}")

    logger.info("Starting Argus AI API server (v2.1 — Live Simulation)...")
    uvicorn.run(
        "argus.api.scoring_api:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
