# 03 — Model Training Experiments & Results

**Generated**: 2026-06-16

---

## Model Comparison (Test Set)

| Model | F1 | Precision | Recall | AUC-ROC | PR-AUC | FPR | TP | FP | FN | TN |
|-------|----|-----------|--------|---------|--------|-----|----|----|----|----|
| XGBoost | **0.9495** | 0.9592 | 0.9400 | 0.9884 | 0.9592 | 0.0012 | 47 | 2 | 3 | 1675 |
| LightGBM | **0.9495** | 0.9592 | 0.9400 | 0.9827 | 0.9589 | 0.0012 | 47 | 2 | 3 | 1675 |
| Meta-Learner | **0.9400** | 0.9400 | 0.9400 | 0.9801 | 0.9586 | 0.0018 | 47 | 3 | 3 | 1674 |
| LSTM-AE | **0.3462** | — | — | — | — | — | — | — | — | — |
| IsolationForest | **0.3051** | — | — | — | — | — | — | — | — | — |

## Top 20 Features (XGBoost Importance)

| Rank | Feature | Importance |
|------|---------|-----------|
| 1 | roll_7d_max_data_volume_mb | 0.306417 |
| 2 | roll_14d_std_data_volume_mb | 0.065445 |
| 3 | expanding_max_systems | 0.061830 |
| 4 | roll_7d_std_novelty_score | 0.050743 |
| 5 | roll_7d_std_is_new_device | 0.037596 |
| 6 | roll_14d_max_data_volume_mb | 0.022676 |
| 7 | clearance_normalized | 0.020968 |
| 8 | novelty_score | 0.017630 |
| 9 | roll_14d_std_data_egress_volume | 0.016874 |
| 10 | zscore_role_unique_systems_accessed | 0.013648 |
| 11 | roll_7d_std_data_egress_volume | 0.011223 |
| 12 | is_new_device | 0.010457 |
| 13 | zscore_dept_data_egress_volume | 0.010303 |
| 14 | zscore_role_data_volume_mb | 0.010106 |
| 15 | is_weekend | 0.009475 |
| 16 | roll_7d_mean_data_volume_mb | 0.008447 |
| 17 | roll_14d_mean_is_after_hours | 0.008394 |
| 18 | expanding_max_data_volume | 0.008060 |
| 19 | is_after_hours | 0.007685 |
| 20 | velocity_data_volume_mb | 0.007646 |

## Experiment Log

```json
[
  {
    "experiment": "SMOTE+Tomek",
    "before_pos": 233,
    "after_pos": 2348,
    "before_total": 8061,
    "after_total": 10176
  },
  {
    "experiment": "XGBoost Standalone",
    "val_f1": 0.9485,
    "val_threshold": 0.438,
    "top_features": [
      "roll_7d_max_data_volume_mb",
      "roll_14d_std_data_volume_mb",
      "expanding_max_systems",
      "roll_7d_std_novelty_score",
      "roll_7d_std_is_new_device",
      "roll_14d_max_data_volume_mb",
      "clearance_normalized",
      "novelty_score",
      "roll_14d_std_data_egress_volume",
      "zscore_role_unique_systems_accessed"
    ]
  },
  {
    "experiment": "LightGBM Standalone",
    "val_f1": 0.9583,
    "val_threshold": 0.35
  },
  {
    "experiment": "Federated MLP (\u03b5-DP)",
    "val_f1": 0.7674,
    "val_threshold": 0.424,
    "epsilon_spent": 0.0319,
    "departments": [
      "retail_banking",
      "treasury",
      "it_admin",
      "hr"
    ]
  },
  {
    "experiment": "Meta-Learner (LR)",
    "val_f1": 0.9485,
    "val_threshold": 0.049
  },
  {
    "experiment": "Simple Blend",
    "val_f1": 0.9485,
    "val_threshold": 0.143
  }
]
```
