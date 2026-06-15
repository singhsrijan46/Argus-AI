"""
Argus AI — FastAPI Scoring & Dashboard API
=============================================
REST API that serves real-time risk scores, trust timelines,
alert explanations, and Digital Twin comparisons to the dashboard.

Endpoints:
    GET  /api/health          — Health check
    GET  /api/employees       — List all employees with trust scores
    GET  /api/employee/{id}   — Single employee detail + twin comparison
    GET  /api/alerts          — Active alerts with explanations
    GET  /api/analytics       — Model metrics and ablation results
    GET  /api/activity        — Live activity feed
    GET  /api/trust-timeline  — Trust score over time per employee
    POST /api/score           — Score a new activity event in real-time

Usage:
    python -m argus.api.scoring_api
"""

import sys
import json
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
import joblib
import torch
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
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
    version="1.0.0",
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


def _get_feature_cols():
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


@app.on_event("startup")
async def load_models():
    """Load all models and data on startup."""
    logger.info("Loading Argus AI models and data...")

    models_dir = Config.paths.MODELS
    data_dir = Config.paths.PROCESSED_DATA
    results_dir = Config.paths.RESULTS
    synthetic_dir = Config.paths.SYNTHETIC_DATA

    try:
        # ─── Load LSTM ───
        checkpoint = torch.load(models_dir / "lstm_autoencoder.pt", weights_only=False, map_location="cpu")
        lstm_model = LSTMAutoencoder(**checkpoint["config"])
        lstm_model.load_state_dict(checkpoint["model_state_dict"])
        lstm_model.eval()
        models["lstm"] = lstm_model
        models["lstm_mean"] = checkpoint["mean"]
        models["lstm_std"] = checkpoint["std"]

        # ─── Load Isolation Forest ───
        if_data = joblib.load(models_dir / "isolation_forest.joblib")
        models["if_model"] = if_data["model"]
        models["if_scaler"] = if_data["scaler"]

        # ─── Load Risk Engine ───
        models["risk_engine"] = joblib.load(models_dir / "risk_engine.joblib")

        # ─── Load data ───
        data["employees"] = pd.read_csv(synthetic_dir / "employees.csv")
        data["features"] = pd.read_csv(data_dir / "features_47d.csv")
        data["ground_truth"] = pd.read_csv(synthetic_dir / "ground_truth.csv")
        data["activity"] = pd.read_csv(synthetic_dir / "activity_log.csv")

        if (results_dir / "metrics.json").exists():
            with open(results_dir / "metrics.json") as f:
                data["metrics"] = json.load(f)

        if (results_dir / "test_predictions.csv").exists():
            data["test_preds"] = pd.read_csv(results_dir / "test_predictions.csv")

        # ─── Setup Explainer ───
        feature_cols = _get_feature_cols()
        explainer = AlertExplainer()
        normal_features = data["features"][data["features"]["label"] == 0]
        explainer.fit(normal_features, feature_cols)
        models["explainer"] = explainer

        # ─── Setup Twin Engine ───
        twin_engine = TwinEngine()
        twin_engine.build_twins(data["features"], feature_cols, data["activity"])
        models["twin_engine"] = twin_engine

        # ─── Compute employee scores ───
        _compute_employee_scores()

        logger.success("✅ All models loaded successfully!")
    except Exception as e:
        logger.error(f"Failed to load models: {e}")
        raise


def _compute_employee_scores():
    """Pre-compute risk/trust scores for all employees."""
    features = data["features"]
    feature_cols = _get_feature_cols()
    engine = models["risk_engine"]

    # Get latest features per employee
    latest = features.sort_values("day_index").groupby("emp_id").last().reset_index()

    # Compute scores for latest features
    X_static = latest[feature_cols].values.astype(float)
    X_static = np.nan_to_num(X_static, 0.0)

    if_scores = compute_if_scores(models["if_model"], models["if_scaler"], X_static)

    # Use IF scores doubled as approximation (no LSTM for single-point)
    risk_scores = engine.compute_risk_scores(if_scores * 1.5, if_scores)
    trust_scores = engine.compute_trust_scores(risk_scores)

    latest["risk_score"] = risk_scores
    latest["trust_score"] = trust_scores
    latest["trust_level"] = trust_scores

    # Merge with employee info
    emp_scores = latest[["emp_id", "risk_score", "trust_score"]].merge(
        data["employees"][["emp_id", "name", "department", "role", "clearance_level", "branch"]],
        on="emp_id", how="left",
    )
    data["emp_scores"] = emp_scores

    # Compute twin drift
    twin_engine = models["twin_engine"]
    drift_df = twin_engine.compute_drift(features)
    latest_drift = drift_df.sort_values("day_index").groupby("emp_id").last().reset_index()
    data["drift"] = latest_drift


# ═══════════════════════════════════════════════════════════════
#  API ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "models_loaded": len(models) > 0,
        "employees": len(data.get("employees", [])),
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/api/employees")
async def get_employees(
    department: str = Query(None),
    sort_by: str = Query("trust_score"),
    order: str = Query("asc"),
    search: str = Query(None),
):
    """List all employees with trust scores."""
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

    # Add drift info
    if "drift" in data:
        df = df.merge(data["drift"][["emp_id", "twin_drift"]], on="emp_id", how="left")
        df["twin_drift"] = df["twin_drift"].fillna(0.0)

    ascending = order == "asc"
    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=ascending)

    return df.to_dict(orient="records")


@app.get("/api/employee/{emp_id}")
async def get_employee(emp_id: str):
    """Get detailed employee profile with twin comparison."""
    emp = data["employees"][data["employees"]["emp_id"] == emp_id]
    if emp.empty:
        raise HTTPException(404, f"Employee {emp_id} not found")

    emp_info = emp.iloc[0].to_dict()
    scores = data["emp_scores"][data["emp_scores"]["emp_id"] == emp_id]

    # Twin comparison
    twin_engine = models["twin_engine"]
    feature_cols = _get_feature_cols()
    latest_features = data["features"][data["features"]["emp_id"] == emp_id].sort_values("day_index").iloc[-1]
    twin_comparison = twin_engine.get_twin_comparison(emp_id, latest_features)

    # Trust timeline
    emp_features = data["features"][data["features"]["emp_id"] == emp_id].sort_values("day_index")
    timeline = []
    for _, row in emp_features.iterrows():
        X_static = row[feature_cols].values.astype(float).reshape(1, -1)
        X_static = np.nan_to_num(X_static, 0.0)
        if_score = compute_if_scores(models["if_model"], models["if_scaler"], X_static)
        risk = models["risk_engine"].compute_risk_scores(if_score * 1.5, if_score)
        trust = models["risk_engine"].compute_trust_scores(risk)
        timeline.append({
            "day_index": int(row["day_index"]),
            "trust_score": round(float(trust[0]), 2),
            "risk_score": round(float(risk[0]), 2),
        })

    # Drift history
    drift_history = []
    if "drift" in data:
        emp_drift = data["drift"][data["drift"]["emp_id"] == emp_id]
        if not emp_drift.empty:
            drift_history = emp_drift.to_dict(orient="records")

    return {
        "employee": emp_info,
        "trust_score": float(scores.iloc[0]["trust_score"]) if not scores.empty else 95.0,
        "risk_score": float(scores.iloc[0]["risk_score"]) if not scores.empty else 5.0,
        "twin_comparison": twin_comparison,
        "trust_timeline": timeline,
        "drift_history": drift_history,
    }


@app.get("/api/alerts")
async def get_alerts(
    severity: str = Query(None),
    limit: int = Query(20),
):
    """Get active alerts with explanations."""
    emp_scores = data["emp_scores"].copy()
    explainer = models["explainer"]
    feature_cols = _get_feature_cols()

    # Find high-risk employees
    high_risk = emp_scores[emp_scores["risk_score"] > 40].sort_values("risk_score", ascending=False)

    alerts = []
    for _, emp in high_risk.head(limit).iterrows():
        emp_id = emp["emp_id"]
        latest = data["features"][data["features"]["emp_id"] == emp_id].sort_values("day_index").iloc[-1]

        explanation = explainer.explain(latest, emp["risk_score"], emp["trust_score"])

        alerts.append({
            "emp_id": emp_id,
            "name": emp.get("name", ""),
            "department": emp.get("department", ""),
            "role": emp.get("role", ""),
            "risk_score": round(float(emp["risk_score"]), 2),
            "trust_score": round(float(emp["trust_score"]), 2),
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

    return alerts


@app.get("/api/analytics")
async def get_analytics():
    """Get model performance metrics."""
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

    return {
        "model_metrics": metrics,
        "department_stats": dept_stats,
        "total_employees": len(data["employees"]),
        "total_insiders": int(data["employees"]["is_insider"].sum()),
        "total_alerts": len(data["emp_scores"][data["emp_scores"]["risk_score"] > 40]),
    }


@app.get("/api/activity")
async def get_activity(
    emp_id: str = Query(None),
    limit: int = Query(50),
):
    """Get recent activity events."""
    activity = data["activity"].copy()

    if emp_id:
        activity = activity[activity["emp_id"] == emp_id]

    # Get latest events
    activity = activity.sort_values("timestamp", ascending=False).head(limit)

    return activity.to_dict(orient="records")


@app.get("/api/overview")
async def get_overview():
    """Dashboard overview stats."""
    emp_scores = data["emp_scores"]
    total = len(emp_scores)
    critical = len(emp_scores[emp_scores["trust_score"] < 20])
    high_risk = len(emp_scores[(emp_scores["trust_score"] >= 20) & (emp_scores["trust_score"] < 40)])
    medium = len(emp_scores[(emp_scores["trust_score"] >= 40) & (emp_scores["trust_score"] < 60)])
    low_risk = len(emp_scores[(emp_scores["trust_score"] >= 60) & (emp_scores["trust_score"] < 80)])
    trusted = len(emp_scores[emp_scores["trust_score"] >= 80])

    metrics = data.get("metrics", {}).get("test", {})

    return {
        "total_employees": total,
        "active_threats": critical + high_risk,
        "trust_distribution": {
            "critical": critical,
            "high_risk": high_risk,
            "medium": medium,
            "low_risk": low_risk,
            "trusted": trusted,
        },
        "model_f1": metrics.get("f1", 0),
        "model_fpr": metrics.get("fpr", 0),
        "model_auc": metrics.get("auc_roc", 0),
    }


# ═══════════════════════════════════════════════════════════════
#  CLI
# ═══════════════════════════════════════════════════════════════

def main():
    import uvicorn
    Config.setup()
    logger.info("Starting Argus AI API server...")
    uvicorn.run(
        "argus.api.scoring_api:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
