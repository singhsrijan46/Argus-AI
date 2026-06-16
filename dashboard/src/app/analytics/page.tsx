'use client';

import Sidebar from '@/components/Sidebar';
import MockBanner from '@/components/MockBanner';
import SimulationControl from '@/components/SimulationControl';
import { modelMetrics as mockMetrics } from '@/lib/mockData';
import { useAnalytics, useSimulation } from '@/lib/hooks';
import { BarChart3, Target, TrendingUp, Layers, Zap } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend);

const chartTooltipConfig = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  titleFont: { family: 'Inter' as const, size: 12 },
  bodyFont: { family: 'Inter' as const, size: 11 },
  borderColor: 'rgba(148, 163, 184, 0.15)',
  borderWidth: 1,
  padding: 12,
  cornerRadius: 8,
};

function MetricGauge({ label, value, max = 1, color, suffix = '' }: { label: string; value: number; max?: number; color: string; suffix?: string }) {
  const pct = (value / max) * 100;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto' }}>
        <svg viewBox="0 0 120 120" width={120} height={120}>
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${pct * 3.14} ${314 - pct * 3.14}`}
            strokeDashoffset="78.5" strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>
            {typeof value === 'number' && value < 1 ? (value * 100).toFixed(1) : value}{suffix}
          </span>
        </div>
      </div>
      <div className="text-xs text-muted mt-8 font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const sim = useSimulation();
  const { data: analytics, isMock } = useAnalytics();

  // Use live metrics if available, else fall back to mock
  const modelMetrics = analytics?.model_metrics?.results
    ? (() => {
        const r = analytics.model_metrics.results as Record<string, Record<string, number>>;
        const best = r[analytics.model_metrics.best_model] || {};
        return {
          f1: best.test_f1 ?? mockMetrics.f1,
          precision: best.test_precision ?? mockMetrics.precision,
          recall: best.test_recall ?? mockMetrics.recall,
          aucRoc: best.test_auc_roc ?? mockMetrics.aucRoc,
          falsePositiveRate: best.test_fpr ?? mockMetrics.falsePositiveRate,
        };
      })()
    : mockMetrics;
  // ─── ROC Curve Mock Data ───
  const rocData = {
    labels: Array.from({ length: 20 }, (_, i) => (i * 5).toString()),
    datasets: [
      {
        label: 'Hybrid (LSTM+IF)',
        data: [0, 15, 35, 52, 65, 74, 80, 85, 88, 90, 92, 93.5, 94.5, 95.5, 96, 96.5, 97, 97.5, 98, 98.2],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.08)',
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: 0,
      },
      {
        label: 'LSTM Only',
        data: [0, 12, 28, 44, 56, 65, 72, 77, 81, 84, 86, 88, 89, 90.5, 91, 92, 92.5, 93, 93.5, 94],
        borderColor: '#8b5cf6',
        borderWidth: 1.5,
        borderDash: [4, 4],
        tension: 0.4,
        pointRadius: 0,
        fill: false,
      },
      {
        label: 'IF Only',
        data: [0, 8, 18, 28, 38, 46, 52, 58, 63, 67, 70, 73, 75, 77, 79, 80, 81, 82, 82.5, 83],
        borderColor: '#f59e0b',
        borderWidth: 1.5,
        borderDash: [4, 4],
        tension: 0.4,
        pointRadius: 0,
        fill: false,
      },
      {
        label: 'Random',
        data: Array.from({ length: 20 }, (_, i) => i * 5),
        borderColor: 'rgba(148, 163, 184, 0.2)',
        borderWidth: 1,
        borderDash: [2, 4],
        tension: 0,
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  // ─── Detection by Scenario ───
  const scenarioData = {
    labels: ['Data Exfil', 'Priv Escalation', 'Pre-Resign', 'Account Snoop', 'Credential', 'Slow Burn'],
    datasets: [{
      label: 'Detection Rate',
      data: [94, 91, 87, 82, 78, 72],
      backgroundColor: [
        'rgba(6, 182, 212, 0.6)',
        'rgba(139, 92, 246, 0.6)',
        'rgba(245, 158, 11, 0.6)',
        'rgba(34, 197, 94, 0.6)',
        'rgba(236, 72, 153, 0.6)',
        'rgba(99, 102, 241, 0.6)',
      ],
      borderWidth: 0,
      borderRadius: 6,
    }],
  };

  // ─── F1 Over Time ───
  const f1Data = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8'],
    datasets: [
      {
        label: 'F1 Score',
        data: [0.72, 0.78, 0.81, 0.84, 0.85, 0.86, 0.87, 0.873],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.08)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#06b6d4',
      },
      {
        label: 'Precision',
        data: [0.68, 0.74, 0.78, 0.80, 0.82, 0.83, 0.84, 0.841],
        borderColor: '#8b5cf6',
        borderWidth: 1.5,
        tension: 0.4,
        pointRadius: 0,
        fill: false,
      },
      {
        label: 'Recall',
        data: [0.76, 0.82, 0.85, 0.88, 0.89, 0.90, 0.90, 0.908],
        borderColor: '#22c55e',
        borderWidth: 1.5,
        tension: 0.4,
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.05)' },
        ticks: { color: '#64748b', font: { size: 10, family: 'JetBrains Mono' } },
      },
      x: {
        grid: { color: 'rgba(148, 163, 184, 0.03)' },
        ticks: { color: '#64748b', font: { size: 10, family: 'JetBrains Mono' } },
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#94a3b8', font: { size: 11, family: 'Inter' }, padding: 16, usePointStyle: true, pointStyleWidth: 8 },
      },
      tooltip: chartTooltipConfig,
    },
  };

  const barOptions = {
    ...lineOptions,
    scales: {
      ...lineOptions.scales,
      y: { ...lineOptions.scales.y, max: 100, ticks: { ...lineOptions.scales.y.ticks, callback: (v: any) => `${v}%` } },
    },
    plugins: {
      ...lineOptions.plugins,
      legend: { display: false },
    },
  };

  // ─── Model Comparison Table ───
  const modelComparison = [
    { model: 'Hybrid (LSTM+IF)', f1: 0.873, precision: 0.841, recall: 0.908, auc: 0.961, fpr: 0.017, highlight: true },
    { model: 'LSTM Only', f1: 0.821, precision: 0.793, recall: 0.851, auc: 0.934, fpr: 0.028, highlight: false },
    { model: 'Isolation Forest', f1: 0.714, precision: 0.682, recall: 0.749, auc: 0.867, fpr: 0.045, highlight: false },
    { model: 'XGBoost (Baseline)', f1: 0.689, precision: 0.671, recall: 0.708, auc: 0.842, fpr: 0.052, highlight: false },
    { model: 'Random Forest', f1: 0.652, precision: 0.639, recall: 0.666, auc: 0.811, fpr: 0.061, highlight: false },
  ];

  return (
    <div className="app-layout">
      <Sidebar day={sim.day} maxDay={sim.maxDay} live={sim.live} />
      <main className="main-content">
        <div className="page-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-title">Model Analytics</h1>
              <p className="page-subtitle">Performance metrics, ablation studies, and model comparisons</p>
            </div>
            <SimulationControl
              day={sim.day} maxDay={sim.maxDay} speed={sim.speed}
              paused={sim.paused} live={sim.live}
              onSetSpeed={sim.setSpeed} onTogglePause={sim.togglePause}
              onReset={sim.reset} onJumpTo={sim.jumpTo}
            />
          </div>
        </div>
        <div className="page-content">
          <MockBanner show={isMock} />
          {/* Gauge Row */}
          <div className="card mb-24">
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-around', padding: '28px 20px' }}>
              <MetricGauge label="F1 Score" value={modelMetrics.f1} color="#06b6d4" suffix="%" />
              <MetricGauge label="Precision" value={modelMetrics.precision} color="#8b5cf6" suffix="%" />
              <MetricGauge label="Recall" value={modelMetrics.recall} color="#22c55e" suffix="%" />
              <MetricGauge label="AUC-ROC" value={modelMetrics.aucRoc} color="#f59e0b" suffix="%" />
              <MetricGauge label="FPR" value={modelMetrics.falsePositiveRate} color="#ef4444" suffix="%" />
            </div>
          </div>

          {/* Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* ROC Curve */}
            <div className="card">
              <div className="card-header">
                <div className="card-title"><Target size={16} style={{ color: 'var(--cyan-500)' }} /> ROC Curve Comparison</div>
              </div>
              <div className="card-body" style={{ height: 300 }}>
                <Line data={rocData} options={{ ...lineOptions, scales: { ...lineOptions.scales, y: { ...lineOptions.scales.y, max: 100, title: { display: true, text: 'True Positive Rate (%)', color: '#64748b', font: { size: 10 } } }, x: { ...lineOptions.scales.x, title: { display: true, text: 'False Positive Rate (%)', color: '#64748b', font: { size: 10 } } } } }} />
              </div>
            </div>

            {/* Detection by Scenario */}
            <div className="card">
              <div className="card-header">
                <div className="card-title"><Layers size={16} style={{ color: 'var(--cyan-500)' }} /> Detection Rate by Scenario</div>
              </div>
              <div className="card-body" style={{ height: 300 }}>
                <Bar data={scenarioData} options={barOptions} />
              </div>
            </div>
          </div>

          {/* F1 Over Time */}
          <div className="card mt-24">
            <div className="card-header">
              <div className="card-title"><TrendingUp size={16} style={{ color: 'var(--cyan-500)' }} /> Model Performance Over Time</div>
            </div>
            <div className="card-body" style={{ height: 260 }}>
              <Line data={f1Data} options={lineOptions} />
            </div>
          </div>

          {/* Model Comparison Table */}
          <div className="card mt-24">
            <div className="card-header">
              <div className="card-title"><BarChart3 size={16} style={{ color: 'var(--cyan-500)' }} /> Model Comparison (Ablation Study)</div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="employee-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>F1 Score</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>AUC-ROC</th>
                    <th>FPR</th>
                  </tr>
                </thead>
                <tbody>
                  {modelComparison.map((m) => (
                    <tr key={m.model} style={m.highlight ? { background: 'rgba(6, 182, 212, 0.04)' } : undefined}>
                      <td>
                        <div className="flex items-center gap-8">
                          {m.highlight && <Zap size={14} style={{ color: '#06b6d4' }} />}
                          <span className={m.highlight ? 'font-bold' : ''}>{m.model}</span>
                          {m.highlight && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'rgba(6,182,212,0.1)', color: '#06b6d4', fontWeight: 700 }}>BEST</span>}
                        </div>
                      </td>
                      <td><span className="text-mono font-semibold" style={{ color: m.f1 > 0.85 ? '#06b6d4' : '#94a3b8' }}>{m.f1.toFixed(3)}</span></td>
                      <td><span className="text-mono">{m.precision.toFixed(3)}</span></td>
                      <td><span className="text-mono">{m.recall.toFixed(3)}</span></td>
                      <td><span className="text-mono">{m.auc.toFixed(3)}</span></td>
                      <td><span className="text-mono" style={{ color: m.fpr < 0.02 ? '#22c55e' : m.fpr < 0.05 ? '#eab308' : '#ef4444' }}>{(m.fpr * 100).toFixed(1)}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
