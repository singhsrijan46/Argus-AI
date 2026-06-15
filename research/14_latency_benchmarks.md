# Latency & Throughput Benchmarks

**Date**: 2026-06-16 03:43
**Hardware**: CPU-only (no GPU)
**Model**: LightGBM + XGBoost (500 trees, depth=6, 211 features)

---

## Raw Model Inference

### Single-Sample Prediction

| Model | Median | P95 | P99 | Mean +/- Std |
|-------|--------|-----|-----|-------------|
| LightGBM | 0.934 ms | 1.500 ms | 1.928 ms | 0.988 +/- 0.261 ms |
| XGBoost | 0.506 ms | 0.756 ms | 1.052 ms | 0.532 +/- 0.138 ms |

### Batch Throughput

| Batch Size | LightGBM (ms) | LightGBM (samples/sec) | XGBoost (ms) | XGBoost (samples/sec) |
|:---:|:---:|:---:|:---:|:---:|
| 1 | 1.006 | 994.0 | 0.427 | 2341.0 |
| 10 | 1.223 | 8176.0 | 0.585 | 17100.0 |
| 50 | 1.412 | 35415.0 | 0.911 | 54879.0 |
| 100 | 1.775 | 56348.0 | 1.167 | 85664.0 |
| 200 | 2.434 | 82179.0 | 1.445 | 138360.0 |
| 500 | 3.667 | 136362.0 | 1.406 | 355543.0 |
| 1000 | 6.285 | 159110.0 | 2.063 | 484625.0 |

---

## SHAP Explanation Latency

| Operation | Latency |
|-----------|--------|
| Explainer init (cold) | 270.5 ms |
| Single explanation | 3.3 ms |
| Batch 10 (total) | 3.8 ms |
| Batch 10 (per sample) | 0.4 ms |

---

## Summary

- **Single-request latency**: 0.934 ms (target: <200ms) -- **PASS**
- **Batch throughput**: 159110 samples/sec (target: 1000+/sec) -- **PASS**
- **SHAP overhead**: Adds ~3 ms per explanation

> **Conclusion**: LightGBM inference is sub-millisecond, well within the 200ms API target.
> Batch scoring easily exceeds 1000 employees/second on CPU alone.
