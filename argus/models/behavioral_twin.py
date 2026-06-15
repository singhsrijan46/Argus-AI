"""
Argus AI — Digital Employee Twin (Behavioral Genome)
======================================================
Maintains a compressed 119-dimensional behavioral representation for each
employee and continuously compares current activity to the baseline twin.

Twin Components (119-dim):
    - Circadian Profile (8-dim):  FFT of login hour distribution
    - Access Embedding (16-dim):  System access pattern encoding
    - Behavioral Baseline (94-dim): Rolling μ/σ of 47 features
    - Drift Velocity (1-dim):     Rate of behavioral change

Key Metric: Twin Drift — cosine distance between baseline twin and current
behavior. High drift = behavioral deviation = potential insider threat.

Research Basis:
    - Rashid et al. (2016): "Who Accessed What, When"
    - Digital Twin concept applied to behavioral modeling

Usage:
    from argus.models.behavioral_twin import TwinEngine
"""

import sys
from pathlib import Path
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from scipy.fft import rfft
from scipy.spatial.distance import cosine
from loguru import logger

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from argus.config import Config


@dataclass
class EmployeeTwin:
    """A single employee's Digital Twin representation."""
    emp_id: str
    circadian_profile: np.ndarray  # (8,) FFT coefficients
    access_embedding: np.ndarray   # (16,) system access encoding
    behavioral_mean: np.ndarray    # (47,) rolling feature means
    behavioral_std: np.ndarray     # (47,) rolling feature stds
    drift_velocity: float = 0.0    # Rate of change

    @property
    def genome(self) -> np.ndarray:
        """Full 119-dim behavioral genome vector."""
        return np.concatenate([
            self.circadian_profile,     # 8
            self.access_embedding,       # 16
            self.behavioral_mean,        # 47
            self.behavioral_std,         # 47
            np.array([self.drift_velocity]),  # 1
        ])  # Total: 119

    def drift_from(self, current_genome: np.ndarray) -> float:
        """Compute cosine distance from baseline genome."""
        baseline = self.genome
        if np.allclose(baseline, 0) or np.allclose(current_genome, 0):
            return 0.0
        return float(cosine(baseline, current_genome))


SYSTEM_LIST = [
    "CRM", "CBS", "Email", "Treasury_Platform", "Bloomberg",
    "Admin_Console", "Servers", "DB_Console", "Staging_DB",
    "HRMS", "AML_Platform", "Audit_System", "Risk_Platform",
    "Ticketing", "AD_Console", "Reports", "Documents",
    "Teller_Terminal", "Payroll_System", "ATS", "JIRA",
    "Production_CBS", "Customer_Records_DB", "Treasury_DB",
    "Audit_Logs", "Device_Manager", "Web_Browser", "Auth",
]


class TwinEngine:
    """
    Manages Digital Employee Twins for the entire workforce.
    """

    def __init__(self, window_size: int = 30):
        """
        Args:
            window_size: Number of days for baseline computation
        """
        self.window_size = window_size
        self.twins: dict[str, EmployeeTwin] = {}
        self.feature_cols: list[str] = []

    def build_twins(
        self,
        features_df: pd.DataFrame,
        feature_cols: list[str],
        activity_df: pd.DataFrame | None = None,
        baseline_days: int = 30,
    ) -> dict[str, EmployeeTwin]:
        """
        Build baseline Digital Twins from the first N days of data.

        Args:
            features_df: Employee-day feature vectors
            feature_cols: The 47 feature column names
            activity_df: Raw activity for circadian profile (optional)
            baseline_days: Number of initial days for baseline

        Returns:
            Dictionary of emp_id → EmployeeTwin
        """
        self.feature_cols = feature_cols
        logger.info(f"Building Digital Twins (baseline: first {baseline_days} days)...")

        for emp_id, emp_data in features_df.groupby("emp_id"):
            baseline = emp_data[emp_data["day_index"] < baseline_days]

            if len(baseline) < 5:
                continue

            # ─── Circadian Profile (8-dim FFT) ───
            login_hours = baseline["login_hour"].values
            circadian = self._compute_circadian(login_hours)

            # ─── Access Embedding (16-dim) ───
            if activity_df is not None:
                emp_activity = activity_df[
                    (activity_df["emp_id"] == emp_id) &
                    (activity_df["day_index"] < baseline_days)
                ]
                access_emb = self._compute_access_embedding(emp_activity)
            else:
                access_emb = np.zeros(16)

            # ─── Behavioral Baseline (47-dim mean + 47-dim std) ───
            feat_values = baseline[feature_cols].values.astype(float)
            feat_values = np.nan_to_num(feat_values, 0.0)
            beh_mean = feat_values.mean(axis=0)
            beh_std = feat_values.std(axis=0)
            beh_std[beh_std == 0] = 1.0

            twin = EmployeeTwin(
                emp_id=emp_id,
                circadian_profile=circadian,
                access_embedding=access_emb,
                behavioral_mean=beh_mean,
                behavioral_std=beh_std,
                drift_velocity=0.0,
            )
            self.twins[emp_id] = twin

        logger.success(f"✅ Built {len(self.twins)} Digital Employee Twins")
        return self.twins

    def compute_drift(
        self,
        features_df: pd.DataFrame,
        activity_df: pd.DataFrame | None = None,
        window_size: int | None = None,
    ) -> pd.DataFrame:
        """
        Compute twin drift for each employee-day.

        Returns:
            DataFrame with emp_id, day_index, twin_drift, drift_components
        """
        if window_size is None:
            window_size = self.window_size

        results = []

        for emp_id, emp_data in features_df.groupby("emp_id"):
            if emp_id not in self.twins:
                continue

            twin = self.twins[emp_id]
            emp_data = emp_data.sort_values("day_index")
            prev_drift = 0.0

            for i, (_, row) in enumerate(emp_data.iterrows()):
                day_idx = row["day_index"]

                # Current window features
                window_start = max(0, i - window_size)
                window = emp_data.iloc[window_start:i + 1]
                feat_values = window[self.feature_cols].values.astype(float)
                feat_values = np.nan_to_num(feat_values, 0.0)

                # Build current genome
                current_login = window["login_hour"].values
                current_circadian = self._compute_circadian(current_login)

                if activity_df is not None:
                    current_activity = activity_df[
                        (activity_df["emp_id"] == emp_id) &
                        (activity_df["day_index"].isin(window["day_index"].values))
                    ]
                    current_access = self._compute_access_embedding(current_activity)
                else:
                    current_access = twin.access_embedding

                current_mean = feat_values.mean(axis=0)
                current_std = feat_values.std(axis=0)
                current_std[current_std == 0] = 1.0

                # Drift velocity
                current_drift_velocity = abs(current_mean.mean() - twin.behavioral_mean.mean())

                current_genome = np.concatenate([
                    current_circadian, current_access,
                    current_mean, current_std,
                    np.array([current_drift_velocity]),
                ])

                # Compute drift
                drift = twin.drift_from(current_genome)

                # Drift acceleration
                drift_delta = drift - prev_drift
                prev_drift = drift

                results.append({
                    "emp_id": emp_id,
                    "day_index": int(day_idx),
                    "twin_drift": round(float(drift), 6),
                    "drift_delta": round(float(drift_delta), 6),
                    "drift_velocity": round(float(current_drift_velocity), 6),
                    "circadian_drift": round(float(cosine(twin.circadian_profile, current_circadian)) if not np.allclose(current_circadian, 0) else 0.0, 6),
                })

        drift_df = pd.DataFrame(results)
        logger.info(f"Computed drift for {drift_df['emp_id'].nunique()} employees, {len(drift_df)} observations")
        return drift_df

    def _compute_circadian(self, login_hours: np.ndarray) -> np.ndarray:
        """Compute 8-dim circadian profile via FFT of login hours."""
        if len(login_hours) < 2:
            return np.zeros(8)

        # Normalize to [0, 1] range
        normalized = login_hours / 24.0

        # Pad/truncate to power of 2 for FFT
        n = min(len(normalized), 64)
        padded = np.zeros(64)
        padded[:n] = normalized[:n]

        # FFT and take first 8 magnitude coefficients
        fft_coeffs = np.abs(rfft(padded))[:8]

        # Normalize
        norm = np.linalg.norm(fft_coeffs)
        if norm > 0:
            fft_coeffs = fft_coeffs / norm

        return fft_coeffs

    def _compute_access_embedding(self, activity_df: pd.DataFrame) -> np.ndarray:
        """Compute 16-dim access pattern embedding from activity logs."""
        embedding = np.zeros(16)

        if activity_df is None or len(activity_df) == 0:
            return embedding

        # System frequency vector (first 16 systems from SYSTEM_LIST, or pad)
        if "system" in activity_df.columns:
            system_counts = activity_df["system"].value_counts()
            for i, sys_name in enumerate(SYSTEM_LIST[:16]):
                if sys_name in system_counts:
                    embedding[i] = system_counts[sys_name]

            # Normalize
            total = embedding.sum()
            if total > 0:
                embedding = embedding / total

        return embedding

    def get_twin_comparison(self, emp_id: str, current_features: dict | pd.Series) -> dict:
        """Get baseline vs current comparison for UI display."""
        if emp_id not in self.twins:
            return {}

        twin = self.twins[emp_id]
        comparison = {
            "dimensions": [],
        }

        # Group features into 8 radar categories
        categories = {
            "Login Pattern": ["login_hour", "logout_hour", "session_duration_hrs"],
            "Data Volume": ["data_volume_mb", "files_accessed", "data_egress_volume"],
            "System Access": ["unique_systems_accessed", "role_boundary_crossings"],
            "Email Activity": ["emails_sent", "external_email_ratio"],
            "Device Usage": ["is_new_device", "device_count", "usb_events"],
            "After-Hours": ["is_after_hours", "login_regularity_score"],
            "Sensitive Access": ["sensitive_file_access", "privilege_escalation_count"],
            "Peer Deviation": ["peer_deviation_score", "behavioral_velocity"],
        }

        for cat_name, feat_list in categories.items():
            baseline_val = 0
            current_val = 0
            for feat in feat_list:
                if feat in self.feature_cols:
                    idx = self.feature_cols.index(feat)
                    mean = twin.behavioral_mean[idx]
                    std = twin.behavioral_std[idx]
                    curr = float(current_features.get(feat, 0)) if isinstance(current_features, dict) else float(current_features.get(feat, 0))
                    baseline_val += abs(mean) / max(1, std)
                    current_val += abs(curr) / max(1, std)

            n = max(1, len(feat_list))
            comparison["dimensions"].append({
                "category": cat_name,
                "baseline": round(baseline_val / n, 3),
                "current": round(current_val / n, 3),
            })

        return comparison
