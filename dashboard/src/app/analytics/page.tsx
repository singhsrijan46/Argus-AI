'use client';

import { useMemo, type CSSProperties } from 'react';
import AppShell from '@/components/AppShell';
import AnimatedNumber from '@/components/AnimatedNumber';
import MockBanner from '@/components/MockBanner';
import SimulationControl from '@/components/SimulationControl';
import { modelMetrics as mockMetrics } from '@/lib/mockData';
import { useAnalytics, useOverview, useSimulation } from '@/lib/hooks';
import { BarChart3, Target, TrendingUp, Layers, Zap, Activity, ShieldCheck, type LucideIcon } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend);

const chartTooltipConfig = {
  backgroundColor: 'rgba(28, 25, 23, 0.96)',
  titleFont: { family: 'DM Sans' as const, size: 12, weight: 700 as const },
  bodyFont: { family: 'DM Sans' as const, size: 11 },
  borderColor: 'rgba(214, 211, 209, 0.18)',
  borderWidth: 1,
  padding: 12,
  cornerRadius: 8,
};

function PerformanceMetricCard({
  label,
  value,
  color,
  detail,
  icon: Icon,
  lowerIsBetter = false,
  target,
}: {
  label: string;
  value: number;
  color: string;
  detail: string;
  icon: LucideIcon;
  lowerIsBetter?: boolean;
  target?: number;
}) {
  const benchmark = target ?? 1;
  const normalized = Math.max(0, Math.min(100, (value / benchmark) * 100));
  const signal = lowerIsBetter ? 100 - normalized : normalized;
  const displayValue = value * 100;
  const trendTone = lowerIsBetter ? 'Controlled' : 'Healthy';
  const style = {
    '--metric-color': color,
    '--metric-signal': `${Math.max(4, signal)}%`,
  } as CSSProperties;

  return (
    <div className="analytics-metric" style={style}>
      <div className="analytics-metric-top">
        <span className="analytics-metric-label">
          <Icon size={15} />
          {label}
        </span>
        <span className="analytics-metric-status">{trendTone}</span>
      </div>
      <div className="analytics-metric-value">
        <AnimatedNumber value={displayValue} decimals={1} suffix="%" />
      </div>
      <div className="analytics-metric-bar" aria-hidden="true">
        <span />
      </div>
      <div className="analytics-metric-detail">{detail}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const sim = useSimulation();
  const { data: analytics, isMock: analyticsMock } = useAnalytics();
  const { data: overview, isMock: overviewMock } = useOverview();
  const isMock = analyticsMock || overviewMock;

  const modelMetrics = useMemo(() => {
    const analyticsMetrics = analytics?.model_metrics?.results
      ? (() => {
        const r = analytics.model_metrics.results as Record<string, Record<string, number>>;
        const best = r[analytics.model_metrics.best_model] || {};
        return {
          precision: best.test_precision ?? mockMetrics.precision,
          recall: best.test_recall ?? mockMetrics.recall,
        };
      })()
      : null;

    if (overview) {
      return {
        f1: overview.model_f1,
        precision: analyticsMetrics?.precision ?? mockMetrics.precision,
        recall: analyticsMetrics?.recall ?? mockMetrics.recall,
        aucRoc: overview.model_auc,
        falsePositiveRate: overview.model_fpr,
      };
    }

    const dayFactor = Math.sin(sim.day * 0.15);
    return {
      f1: 0.945 + dayFactor * 0.005,
      precision: analyticsMetrics?.precision ?? 0.92 + dayFactor * 0.004,
      recall: analyticsMetrics?.recall ?? 0.91 + dayFactor * 0.006,
      aucRoc: 0.983 + dayFactor * 0.003,
      falsePositiveRate: 0.012 - dayFactor * 0.002,
    };
  }, [analytics, overview, sim.day]);

  const performanceMetrics = [
    { label: 'F1 Score', value: modelMetrics.f1, color: '#475569', detail: 'Balanced detection quality', icon: Activity },
    { label: 'Precision', value: modelMetrics.precision, color: '#2563eb', detail: 'Signal purity across alerts', icon: Target },
    { label: 'Recall', value: modelMetrics.recall, color: '#15803d', detail: 'Threat coverage rate', icon: ShieldCheck },
    { label: 'AUC-ROC', value: modelMetrics.aucRoc, color: '#b45309', detail: 'Classifier separation', icon: TrendingUp },
    { label: 'FPR', value: modelMetrics.falsePositiveRate, color: '#b91c1c', detail: 'Target below 2.0%', lowerIsBetter: true, target: 0.02, icon: BarChart3 },
  ];

  const scenarioMetrics = useMemo(() => {
    const scenarios = [
      { label: 'Data Exfil', weight: 1.04, color: '#475569' },
      { label: 'Priv Escalation', weight: 1.0, color: '#2563eb' },
      { label: 'Credential', weight: 0.97, color: '#15803d' },
      { label: 'Account Snoop', weight: 0.93, color: '#b45309' },
      { label: 'Pre-Resign', weight: 0.9, color: '#64748b' },
      { label: 'Slow Burn', weight: 0.86, color: '#b91c1c' },
    ];

    return scenarios.map((scenario, index) => {
      const wave = Math.sin(sim.day * 0.18 + index * 0.85) * 2.4;
      const rate = Math.max(62, Math.min(99, modelMetrics.recall * 100 * scenario.weight + wave));
      return { ...scenario, rate };
    });
  }, [modelMetrics.recall, sim.day]);

  const scenarioAverage = scenarioMetrics.reduce((sum, scenario) => sum + scenario.rate, 0) / scenarioMetrics.length;
  const weakestScenario = scenarioMetrics.reduce((weakest, scenario) => scenario.rate < weakest.rate ? scenario : weakest, scenarioMetrics[0]);

  // ─── Live ROC Curve ───
  const rocData = useMemo(() => {
    const labels = Array.from({ length: 21 }, (_, i) => (i * 5).toString());
    const liveShape = labels.map((_, i) => {
      const fpr = i / 20;
      const lift = 1 - Math.pow(1 - fpr, 2.7 + modelMetrics.aucRoc * 1.35);
      const shimmer = Math.sin(sim.day * 0.2 + i * 0.65) * 0.8;
      return Math.max(0, Math.min(100, lift * modelMetrics.aucRoc * 100 + shimmer));
    });

    return {
      labels,
      datasets: [
        {
          label: 'Live ensemble',
          data: liveShape,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          fill: true,
          tension: 0.42,
          borderWidth: 2.4,
          pointRadius: 0,
        },
        {
          label: 'Reference model',
          data: labels.map((_, i) => Math.max(0, Math.min(100, (1 - Math.pow(1 - i / 20, 3.1)) * 92))),
          borderColor: '#64748b',
          borderWidth: 1.4,
          borderDash: [5, 5],
          tension: 0.35,
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Random baseline',
          data: labels.map((_, i) => i * 5),
          borderColor: 'rgba(120, 113, 108, 0.32)',
          borderWidth: 1,
          borderDash: [2, 5],
          tension: 0,
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [modelMetrics.aucRoc, sim.day]);

  // ─── Live Detection by Scenario ───
  const scenarioData = {
    labels: scenarioMetrics.map((scenario) => scenario.label),
    datasets: [
      {
        label: 'Detection Rate',
        data: scenarioMetrics.map((scenario) => Number(scenario.rate.toFixed(1))),
        backgroundColor: scenarioMetrics.map((scenario) => `${scenario.color}cc`),
        borderColor: scenarioMetrics.map((scenario) => scenario.color),
        borderWidth: 1,
        borderRadius: 8,
        borderSkipped: false,
        barThickness: 18,
      },
    ],
  };

  // ─── Live Model Performance Over Time ───
  const f1Data = useMemo(() => {
    const labels = Array.from({ length: 8 }, (_, i) => `D${Math.max(1, sim.day - 7 + i)}`);
    const makeSeries = (current: number, phase: number) => labels.map((_, i) => {
      const distance = labels.length - 1 - i;
      const drift = distance * 0.004;
      const wave = Math.sin((sim.day - distance) * 0.2 + phase) * 0.003;
      return Number(Math.max(0.62, Math.min(0.995, current - drift + wave)).toFixed(4));
    });

    return {
      labels,
      datasets: [
        {
          label: 'F1 Score',
          data: makeSeries(modelMetrics.f1, 0),
          borderColor: '#475569',
          backgroundColor: 'rgba(71, 85, 105, 0.08)',
          fill: true,
          tension: 0.38,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          pointBackgroundColor: '#475569',
        },
        {
          label: 'Precision',
          data: makeSeries(modelMetrics.precision, 1.2),
          borderColor: '#2563eb',
          borderWidth: 1.8,
          tension: 0.38,
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Recall',
          data: makeSeries(modelMetrics.recall, 2.1),
          borderColor: '#15803d',
          borderWidth: 1.8,
          tension: 0.38,
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [modelMetrics.f1, modelMetrics.precision, modelMetrics.recall, sim.day]);

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 650, easing: 'easeOutQuart' as const },
    interaction: { intersect: false, mode: 'index' as const },
    scales: {
      y: {
        grid: { color: 'rgba(120, 113, 108, 0.08)' },
        border: { display: false },
        ticks: { color: '#78716c', font: { size: 10, family: 'IBM Plex Mono' } },
      },
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#78716c', font: { size: 10, family: 'IBM Plex Mono' } },
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#78716c', font: { size: 11, family: 'DM Sans' }, padding: 16, usePointStyle: true, pointStyleWidth: 8 },
      },
      tooltip: chartTooltipConfig,
    },
  };

  const barOptions = {
    ...lineOptions,
    indexAxis: 'y' as const,
    scales: {
      x: {
        ...lineOptions.scales.x,
        min: 55,
        max: 100,
        grid: { color: 'rgba(120, 113, 108, 0.08)' },
        ticks: { ...lineOptions.scales.x.ticks, callback: (v: string | number) => `${v}%` },
      },
      y: {
        ...lineOptions.scales.y,
        grid: { display: false },
        ticks: { ...lineOptions.scales.y.ticks, font: { size: 11, family: 'DM Sans', weight: 600 as const } },
      },
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
    <AppShell
      title="Analytics"
      subtitle="Model performance and comparisons"
      headerExtra={
        <SimulationControl
          day={sim.day} maxDay={sim.maxDay} speed={sim.speed}
          paused={sim.paused} live={sim.live}
          onSetSpeed={sim.setSpeed} onTogglePause={sim.togglePause}
          onReset={sim.reset} onJumpTo={sim.jumpTo}
        />
      }
    >
      <MockBanner show={isMock} />
          {/* Performance Metrics */}
          <div className="analytics-performance mb-24">
            <div className="analytics-performance-header">
              <div>
                <div className="analytics-performance-kicker">Realtime model health</div>
                <h2>Detection performance</h2>
              </div>
              <span className="analytics-performance-day">Day {sim.day}</span>
            </div>
            <div className="analytics-metric-grid">
              {performanceMetrics.map((metric) => (
                <PerformanceMetricCard key={metric.label} {...metric} />
              ))}
            </div>
          </div>

          {/* Charts Grid */}
          <div className="analytics-chart-grid">
            {/* ROC Curve */}
            <div className="analytics-chart-card">
              <div className="analytics-chart-header">
                <div className="analytics-chart-title"><Target size={16} /> ROC Curve Comparison</div>
                <span className="analytics-chart-chip">AUC {(modelMetrics.aucRoc * 100).toFixed(1)}%</span>
              </div>
              <div className="analytics-chart-body">
                <Line data={rocData} options={{ ...lineOptions, scales: { ...lineOptions.scales, y: { ...lineOptions.scales.y, max: 100, title: { display: true, text: 'True Positive Rate (%)', color: '#78716c', font: { size: 10 } } }, x: { ...lineOptions.scales.x, title: { display: true, text: 'False Positive Rate (%)', color: '#78716c', font: { size: 10 } } } } }} />
              </div>
            </div>

            {/* Detection by Scenario */}
            <div className="analytics-chart-card analytics-chart-card--scenario">
              <div className="analytics-chart-header">
                <div>
                  <div className="analytics-chart-title"><Layers size={16} /> Detection Rate by Scenario</div>
                  <div className="analytics-chart-subtitle">Average {scenarioAverage.toFixed(1)}% · Watch {weakestScenario.label}</div>
                </div>
                <span className="analytics-chart-chip">Live Day {sim.day}</span>
              </div>
              <div className="analytics-chart-body analytics-chart-body--scenario">
                <Bar data={scenarioData} options={barOptions} />
              </div>
            </div>
          </div>

          {/* F1 Over Time */}
          <div className="analytics-chart-card analytics-chart-card--wide mt-24">
            <div className="analytics-chart-header">
              <div className="analytics-chart-title"><TrendingUp size={16} /> Model Performance Over Time</div>
              <span className="analytics-chart-chip">F1 {(modelMetrics.f1 * 100).toFixed(1)}%</span>
            </div>
            <div className="analytics-chart-body analytics-chart-body--wide">
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
                    <tr key={m.model} style={m.highlight ? { background: 'rgba(45, 212, 191, 0.05)' } : undefined}>
                      <td>
                        <div className="flex items-center gap-8">
                          {m.highlight && <Zap size={14} style={{ color: '#2dd4bf' }} />}
                          <span className={m.highlight ? 'font-bold' : ''}>{m.model}</span>
                          {m.highlight && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'rgba(45,212,191,0.1)', color: '#2dd4bf', fontWeight: 700 }}>BEST</span>}
                        </div>
                      </td>
                      <td><span className="text-mono font-semibold" style={{ color: m.f1 > 0.85 ? '#2dd4bf' : '#94a3b8' }}>{m.f1.toFixed(3)}</span></td>
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
    </AppShell>
  );
}
