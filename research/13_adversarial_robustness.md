# Adversarial Robustness & Detection Latency

**Date**: 2026-06-16 03:43
**Model**: LightGBM (500 trees, depth=6, 211 features)
**Baseline**: F1=0.9221, AUC=0.9882
**Simulation**: 30-day insider campaigns per strategy

---

## Detection Latency (Days Until First Flag)

| Strategy | Threshold=0.3 | Threshold=0.5 | Threshold=0.7 | Detection Rate (t=0.5) | Peak P(insider) |
|----------|:---:|:---:|:---:|:---:|:---:|
| Baseline (no evasion) | Day 0 | Day 0 | Day 0 | 100.0% | 1.0 |
| Slow ramp (30-day) | Day 6 | Day 7 | Day 7 | 76.7% | 1.0 |
| Intermittent (every 3rd day) | Day 0 | Day 0 | Day 0 | 33.3% | 1.0 |
| Intermittent (every 5th day) | Day 0 | Day 0 | Day 0 | 20.0% | 1.0 |
| Mimicry (2-sigma clamp) | Day 0 | Day 0 | Day 0 | 100.0% | 0.9966 |
| Mimicry (1-sigma clamp) | Never | Never | Never | 0.0% | 0.0 |
| Adaptive decay | Day 0 | Day 0 | Day 0 | 36.7% | 1.0 |

---

## Key Findings

1. **Easiest to detect**: Baseline (no evasion)
2. **Hardest to detect**: Mimicry (1-sigma clamp)
3. **Strategies that evade detection (t=0.5)**: Mimicry (1-sigma clamp)

### Probability Trajectories (first 10 days)

| Day | Baseline (no evasion) | Slow ramp (30-day) | Intermittent (every 3rd day) | Intermittent (every 5th day) | Mimicry (2-sigma clamp) | Mimicry (1-sigma clamp) | Adaptive decay |
|-----|---:|---:|---:|---:|---:|---:|---:|
| 0 | 1.000 | 0.000 | 1.000 | 1.000 | 0.997 | 0.000 | 1.000 |
| 1 | 1.000 | 0.000 | 0.000 | 0.000 | 0.997 | 0.000 | 1.000 |
| 2 | 1.000 | 0.000 | 0.000 | 0.000 | 0.997 | 0.000 | 1.000 |
| 3 | 1.000 | 0.000 | 1.000 | 0.000 | 0.997 | 0.000 | 1.000 |
| 4 | 1.000 | 0.000 | 0.000 | 0.000 | 0.997 | 0.000 | 1.000 |
| 5 | 1.000 | 0.015 | 0.000 | 1.000 | 0.997 | 0.000 | 1.000 |
| 6 | 1.000 | 0.309 | 1.000 | 0.000 | 0.997 | 0.000 | 1.000 |
| 7 | 1.000 | 0.747 | 0.000 | 0.000 | 0.997 | 0.000 | 0.998 |
| 8 | 1.000 | 0.999 | 0.000 | 0.000 | 0.997 | 0.000 | 0.999 |
| 9 | 1.000 | 0.993 | 1.000 | 0.000 | 0.997 | 0.000 | 0.971 |

---

## Implications

- **Rolling window features** (14-day) are critical for catching slow-ramp attacks
- **Intermittent attackers** are harder to catch because normal days dilute signal
- **Mimicry (1-sigma)** is the most realistic evasion — attacker stays within normal bounds
- **Recommendation**: Use temporal sequence models (LSTM) alongside GBDT for slow-evolving threats
