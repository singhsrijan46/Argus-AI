"""
Argus AI — Explainable Alert Engine (SHAP + Intent Chains)
============================================================
Generates human-readable explanations for why an alert was triggered.
Uses SHAP-inspired feature attribution and intent signal chain matching.

Key Concepts:
    - Feature Attribution: Which features contributed most to the risk score
    - Intent Signal Chains: Mapping detected anomalies to known attack patterns
    - Recommended Actions: Risk-proportional response suggestions

Research Basis:
    - Lundberg & Lee (2017): SHAP (SHapley Additive exPlanations)
    - MITRE ATT&CK for Enterprise: Insider Threat TTPs

Usage:
    from argus.models.explainer import AlertExplainer
"""

import sys
from pathlib import Path
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from loguru import logger

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from argus.config import Config


# ═══════════════════════════════════════════════════════════════
#  INTENT SIGNAL CHAINS (ISC)
# ═══════════════════════════════════════════════════════════════

INTENT_CHAINS = {
    "data_exfiltration": {
        "name": "Data Exfiltration",
        "signals": [
            {"step": "recon", "label": "Unusual data browsing", "features": ["files_accessed", "unique_systems_accessed", "sensitive_file_access"]},
            {"step": "staging", "label": "Bulk data access", "features": ["data_volume_mb", "records_accessed", "large_download_flag"]},
            {"step": "collection", "label": "Data aggregation", "features": ["file_copy_count", "data_egress_volume"]},
            {"step": "exfiltration", "label": "Data transfer", "features": ["usb_events", "usb_file_transfers", "cloud_upload_count"]},
            {"step": "cover", "label": "After-hours activity", "features": ["is_after_hours", "login_hour"]},
        ],
        "min_signals": 3,
    },
    "privilege_escalation": {
        "name": "Privilege Escalation",
        "signals": [
            {"step": "recon", "label": "System exploration", "features": ["unique_systems_accessed", "role_boundary_crossings"]},
            {"step": "escalation", "label": "Privilege elevation", "features": ["privilege_escalation_count", "access_to_role_ratio"]},
            {"step": "access", "label": "Unauthorized system access", "features": ["sensitive_file_access", "longest_unusual_chain"]},
            {"step": "persistence", "label": "Maintaining access", "features": ["is_new_device", "login_regularity_score"]},
            {"step": "cover", "label": "After-hours activity", "features": ["is_after_hours", "login_hour"]},
        ],
        "min_signals": 3,
    },
    "pre_resignation_theft": {
        "name": "Pre-Resignation Data Theft",
        "signals": [
            {"step": "intent", "label": "Job search activity", "features": ["urls_visited"]},
            {"step": "recon", "label": "Expanded data access", "features": ["files_accessed", "unique_systems_accessed"]},
            {"step": "staging", "label": "Increased data volume", "features": ["data_volume_mb", "data_egress_volume"]},
            {"step": "exfil", "label": "External data sharing", "features": ["external_email_ratio", "cloud_upload_count"]},
            {"step": "anomaly", "label": "Behavioral shift", "features": ["peer_deviation_score", "behavioral_velocity"]},
        ],
        "min_signals": 3,
    },
    "unauthorized_snooping": {
        "name": "Unauthorized Account Snooping",
        "signals": [
            {"step": "curiosity", "label": "Cross-role access", "features": ["access_to_role_ratio", "role_boundary_crossings"]},
            {"step": "browse", "label": "Record browsing", "features": ["files_accessed", "sensitive_file_access"]},
            {"step": "pattern", "label": "Repeated snooping", "features": ["repeat_pattern_score", "session_action_diversity"]},
            {"step": "stealth", "label": "Low-volume persistence", "features": ["data_volume_mb", "behavioral_velocity"]},
        ],
        "min_signals": 2,
    },
    "credential_compromise": {
        "name": "Credential Compromise / Account Takeover",
        "signals": [
            {"step": "anomaly", "label": "Impossible travel", "features": ["geo_anomaly_flag"]},
            {"step": "device", "label": "New device usage", "features": ["is_new_device", "device_count"]},
            {"step": "timing", "label": "Unusual login times", "features": ["login_regularity_score", "login_hour"]},
            {"step": "behavior", "label": "Behavioral deviation", "features": ["peer_deviation_score", "novelty_score"]},
            {"step": "access", "label": "Rapid system switching", "features": ["unique_systems_accessed", "behavioral_velocity"]},
        ],
        "min_signals": 3,
    },
    "slow_burn_recon": {
        "name": "Slow Burn Reconnaissance",
        "signals": [
            {"step": "expansion", "label": "Gradual scope expansion", "features": ["unique_systems_accessed", "access_to_role_ratio"]},
            {"step": "stealth", "label": "Low anomaly footprint", "features": ["peer_deviation_score", "novelty_score"]},
            {"step": "persistence", "label": "Consistent minor deviations", "features": ["command_diversity_index", "action_sequence_entropy"]},
            {"step": "data", "label": "Incrementing data access", "features": ["data_volume_mb", "files_accessed"]},
        ],
        "min_signals": 2,
    },
}

# Feature display names for readable explanations
FEATURE_DISPLAY = {
    "login_hour": "Login Time",
    "logout_hour": "Logout Time",
    "session_duration_hrs": "Session Duration",
    "is_after_hours": "After-Hours Access",
    "is_weekend": "Weekend Activity",
    "files_accessed": "Files Accessed",
    "data_volume_mb": "Data Volume",
    "unique_systems_accessed": "Unique Systems",
    "usb_events": "USB Events",
    "is_new_device": "New Device",
    "geo_anomaly_flag": "Geo Anomaly",
    "external_email_ratio": "External Email Ratio",
    "sensitive_file_access": "Sensitive System Access",
    "data_egress_volume": "Data Egress",
    "access_to_role_ratio": "Out-of-Role Access",
    "peer_deviation_score": "Peer Deviation",
    "privilege_escalation_count": "Privilege Escalations",
    "role_boundary_crossings": "Role Boundary Crossings",
    "behavioral_velocity": "Behavioral Velocity",
    "novelty_score": "Novelty Score",
    "file_copy_count": "File Copies",
    "usb_file_transfers": "USB Transfers",
    "large_download_flag": "Large Download",
    "cloud_upload_count": "Cloud Uploads",
    "longest_unusual_chain": "Longest Unusual Chain",
    "login_regularity_score": "Login Irregularity",
    "device_count": "Device Count",
    "repeat_pattern_score": "Repeat Pattern",
    "session_action_diversity": "Action Diversity",
    "command_diversity_index": "Command Diversity",
    "action_sequence_entropy": "Action Entropy",
    "urls_visited": "URLs Visited",
    "temporal_entropy": "Temporal Entropy",
}


@dataclass
class AlertExplanation:
    """Structured explanation for an alert."""
    emp_id: str
    risk_score: float
    trust_score: float
    severity: str
    matched_chain: str | None = None
    chain_confidence: float = 0.0
    chain_signals: list[dict] = field(default_factory=list)
    top_features: list[dict] = field(default_factory=list)
    recommended_actions: list[str] = field(default_factory=list)
    summary: str = ""


class AlertExplainer:
    """
    Generates human-readable explanations for insider threat alerts.
    """

    def __init__(self, feature_means: np.ndarray | None = None, feature_stds: np.ndarray | None = None):
        self.feature_means = feature_means
        self.feature_stds = feature_stds

    def fit(self, normal_features: pd.DataFrame, feature_cols: list[str]):
        """Learn normal feature statistics for deviation analysis."""
        self.feature_cols = feature_cols
        self.feature_means = normal_features[feature_cols].mean().values
        self.feature_stds = normal_features[feature_cols].std().values
        self.feature_stds[self.feature_stds == 0] = 1.0
        logger.info(f"Explainer fitted on {len(normal_features)} normal samples")

    def explain(
        self,
        features: dict | pd.Series,
        risk_score: float,
        trust_score: float,
    ) -> AlertExplanation:
        """
        Generate a full explanation for a single alert.

        Args:
            features: Feature values for the flagged employee-day
            risk_score: Computed risk score (0-100)
            trust_score: Computed trust score (0-100)

        Returns:
            AlertExplanation with matched chain, top features, and recommendations
        """
        severity = self._get_severity(risk_score)

        # ─── Feature Attribution ───
        top_features = self._compute_feature_attribution(features)

        # ─── Intent Chain Matching ───
        matched_chain, chain_confidence, chain_signals = self._match_intent_chain(features)

        # ─── Recommended Actions ───
        actions = self._get_recommended_actions(severity, matched_chain, top_features)

        # ─── Summary ───
        summary = self._generate_summary(features, severity, matched_chain, top_features)

        return AlertExplanation(
            emp_id=features.get("emp_id", "UNKNOWN") if isinstance(features, dict) else features.get("emp_id", "UNKNOWN"),
            risk_score=risk_score,
            trust_score=trust_score,
            severity=severity,
            matched_chain=matched_chain,
            chain_confidence=chain_confidence,
            chain_signals=chain_signals,
            top_features=top_features[:8],
            recommended_actions=actions,
            summary=summary,
        )

    def _compute_feature_attribution(self, features: dict | pd.Series) -> list[dict]:
        """Compute z-score based feature attribution (SHAP-inspired)."""
        attributions = []

        for i, col in enumerate(self.feature_cols):
            val = features.get(col, 0) if isinstance(features, dict) else features.get(col, 0)
            val = float(val) if val is not None else 0.0

            z_score = (val - self.feature_means[i]) / self.feature_stds[i]
            display_name = FEATURE_DISPLAY.get(col, col.replace("_", " ").title())

            attributions.append({
                "feature": col,
                "display_name": display_name,
                "value": val,
                "z_score": round(z_score, 3),
                "abs_z": abs(z_score),
                "direction": "above" if z_score > 0 else "below",
                "significant": abs(z_score) > 2.0,
            })

        # Sort by absolute z-score
        attributions.sort(key=lambda x: x["abs_z"], reverse=True)
        return attributions

    def _match_intent_chain(self, features: dict | pd.Series) -> tuple[str | None, float, list[dict]]:
        """Match observed anomalies to known intent signal chains."""
        best_chain = None
        best_confidence = 0.0
        best_signals = []

        for chain_name, chain_def in INTENT_CHAINS.items():
            matched = []
            total = len(chain_def["signals"])

            for signal in chain_def["signals"]:
                signal_triggered = False
                max_z = 0.0

                for feat in signal["features"]:
                    val = features.get(feat, 0) if isinstance(features, dict) else features.get(feat, 0)
                    val = float(val) if val is not None else 0.0

                    if feat in self.feature_cols:
                        idx = self.feature_cols.index(feat)
                        z = (val - self.feature_means[idx]) / self.feature_stds[idx]
                        if abs(z) > 1.5:
                            signal_triggered = True
                            max_z = max(max_z, abs(z))

                matched.append({
                    "step": signal["step"],
                    "label": signal["label"],
                    "triggered": signal_triggered,
                    "strength": round(max_z, 2),
                })

            n_matched = sum(1 for m in matched if m["triggered"])
            confidence = n_matched / total

            if n_matched >= chain_def["min_signals"] and confidence > best_confidence:
                best_chain = chain_name
                best_confidence = confidence
                best_signals = matched

        return best_chain, round(best_confidence, 3), best_signals

    def _get_severity(self, risk_score: float) -> str:
        if risk_score >= 80:
            return "CRITICAL"
        elif risk_score >= 60:
            return "HIGH"
        elif risk_score >= 40:
            return "MEDIUM"
        else:
            return "LOW"

    def _get_recommended_actions(
        self, severity: str, chain: str | None, features: list[dict]
    ) -> list[str]:
        """Generate risk-proportional response recommendations."""
        actions = []

        if severity == "CRITICAL":
            actions.append("🚨 Immediately restrict account access")
            actions.append("📞 Notify CISO and initiate incident response")
            actions.append("🔒 Freeze data egress channels (USB, email, cloud)")
        elif severity == "HIGH":
            actions.append("⚠️ Escalate to security operations team")
            actions.append("🔍 Review last 7 days of activity logs")
            actions.append("📋 Trigger enhanced monitoring for this employee")
        elif severity == "MEDIUM":
            actions.append("👁️ Add to watchlist for enhanced monitoring")
            actions.append("📊 Schedule behavioral review with manager")
        else:
            actions.append("📝 Log for trend analysis")

        # Chain-specific actions
        if chain == "data_exfiltration":
            actions.append("💾 Check for USB device connections in endpoint logs")
            actions.append("📧 Review outbound email attachments")
        elif chain == "privilege_escalation":
            actions.append("🔑 Audit all privilege changes in the last 48 hours")
            actions.append("🖥️ Review admin console access logs")
        elif chain == "credential_compromise":
            actions.append("🔐 Force password reset and MFA re-enrollment")
            actions.append("🌍 Verify employee's physical location")
        elif chain == "pre_resignation_theft":
            actions.append("👤 Check with HR for resignation status")
            actions.append("📂 Audit document downloads and cloud uploads")

        return actions

    def _generate_summary(
        self, features: dict | pd.Series, severity: str,
        chain: str | None, top_features: list[dict],
    ) -> str:
        """Generate a one-line human-readable summary."""
        top_3 = [f["display_name"] for f in top_features[:3] if f["significant"]]
        feature_str = ", ".join(top_3) if top_3 else "multiple indicators"

        chain_name = INTENT_CHAINS[chain]["name"] if chain else "unknown pattern"

        return (
            f"{severity} alert: Anomalous {feature_str} detected. "
            f"Pattern matches {chain_name} intent chain."
        )

    def explain_batch(
        self,
        features_df: pd.DataFrame,
        risk_scores: np.ndarray,
        trust_scores: np.ndarray,
        threshold: float = 50.0,
    ) -> list[AlertExplanation]:
        """Generate explanations for all alerts above threshold."""
        alerts = []
        for i in range(len(features_df)):
            if risk_scores[i] >= threshold:
                row = features_df.iloc[i]
                explanation = self.explain(row, risk_scores[i], trust_scores[i])
                alerts.append(explanation)

        # Sort by risk score (highest first)
        alerts.sort(key=lambda x: x.risk_score, reverse=True)
        logger.info(f"Generated {len(alerts)} alert explanations")
        return alerts
