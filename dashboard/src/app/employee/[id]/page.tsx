'use client';

import { use, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import MockBanner from '@/components/MockBanner';
import SimulationControl from '@/components/SimulationControl';
import GeminiReport from '@/components/GeminiReport';
import {
  getEmployee, getAlertsByEmployee, getTrustColor,
  privilegeDecayTimeline, sampleTwinProfile, activityFeed,
} from '@/lib/mockData';
import { useEmployee, useShapExplanation, useSimulation, useActivity } from '@/lib/hooks';
import {
  ArrowLeft, Shield, AlertTriangle, Clock, Fingerprint,
  Cpu, TrendingDown, Eye, Zap, Brain, Activity, Database, HardDrive, Monitor, Network,
} from 'lucide-react';
import Link from 'next/link';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  RadialLinearScale, BarElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { Line, Radar, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, RadialLinearScale, Filler, Tooltip, Legend);

// ─── SHAP Waterfall Component ───
function ShapWaterfall({ shapData }: { shapData: any }) {
  if (!shapData) return null;

  const riskFactors = shapData.top_risk_factors?.slice(0, 8) || [];
  const protFactors = shapData.top_protective_factors?.slice(0, 4) || [];
  const allFactors = [
    ...riskFactors.map((f: any) => ({ ...f, type: 'risk' })),
    ...protFactors.map((f: any) => ({ ...f, type: 'protect' })),
  ];

  if (allFactors.length === 0) return null;

  const maxVal = Math.max(...allFactors.map((f: any) => Math.abs(f.shap_value)));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between mb-8">
        <div className="text-xs text-muted">
          Base: {(shapData.base_value * 100).toFixed(1)}% → Prediction: {(shapData.prediction * 100).toFixed(1)}%
        </div>
        <div className="text-xs text-mono" style={{ color: shapData.prediction > 0.5 ? '#ef4444' : '#22c55e' }}>
          P(insider) = {(shapData.prediction * 100).toFixed(1)}%
        </div>
      </div>

      {allFactors.map((f: any, i: number) => {
        const barWidth = Math.min(100, (Math.abs(f.shap_value) / maxVal) * 100);
        const isRisk = f.type === 'risk';
        const color = isRisk ? '#ef4444' : '#22c55e';
        const bgColor = isRisk ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)';
        const featureName = f.feature.replace(/_/g, ' ').replace(/roll /g, '').replace(/zscore /g, 'z:');
        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '180px 1fr 60px',
            alignItems: 'center', gap: 12, padding: '6px 10px',
            borderRadius: 'var(--radius-md)', background: bgColor,
            border: `1px solid ${color}15`,
          }}>
            <div className="text-xs text-mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isRisk ? '↑' : '↓'} {featureName}
            </div>
            <div style={{ position: 'relative', height: 14, background: 'rgba(148,163,184,0.06)', borderRadius: 4 }}>
              <div style={{
                position: 'absolute',
                [isRisk ? 'left' : 'right']: 0,
                top: 0, height: '100%',
                width: `${barWidth}%`,
                background: `linear-gradient(${isRisk ? '90deg' : '270deg'}, ${color}80, ${color}20)`,
                borderRadius: 4,
                transition: 'width 0.8s ease',
              }} />
            </div>
            <div className="text-xs text-mono" style={{ color, textAlign: 'right', fontWeight: 700 }}>
              {f.shap_value > 0 ? '+' : ''}{f.shap_value.toFixed(3)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function EmployeeDetailPage(props: { params: Promise<{ id: string }> }) {
  const { params: rawParams } = props;
  const params = use(rawParams);
  const id = params.id;

  const sim = useSimulation();
  const { data: liveDetail, isMock } = useEmployee(id);
  const { data: shapData, loading: shapLoading } = useShapExplanation(id);
  const { data: liveActivity } = useActivity(id, 20);
  const mockEmp = getEmployee(id);
  const mockAlerts = getAlertsByEmployee(id);

  // Use live data if available
  const empName = liveDetail?.employee?.name as string || mockEmp?.name || id;
  const empRole = liveDetail?.employee?.role as string || mockEmp?.role || '';
  const empDept = liveDetail?.employee?.department as string || mockEmp?.department || '';
  const empBranch = liveDetail?.employee?.branch as string || mockEmp?.branch || '';
  const empClearance = (liveDetail?.employee?.clearance_level as number) || mockEmp?.clearanceLevel || 1;
  const trustScore = Math.round(liveDetail?.trust_score ?? mockEmp?.trustScore ?? 95);
  const riskScore = Math.round(liveDetail?.risk_score ?? 5);
  const twinDrift = mockEmp?.twinDrift ?? 0;
  const isHighRisk = trustScore < 40;

  // Trust timeline from API
  const liveTimeline = liveDetail?.trust_timeline || [];

  // Use live twin comparison if available, else fall back to mock
  const twinDimensions = (liveDetail?.twin_comparison?.dimensions && liveDetail.twin_comparison.dimensions.length > 0)
    ? liveDetail.twin_comparison.dimensions.map(d => ({
        label: d.category,
        expected: Math.round(d.baseline * 100),
        actual: Math.round(d.current * 100),
      }))
    : sampleTwinProfile.dimensions;

  const decay = useMemo(() => {
    if (liveTimeline.length > 5) {
      const visibleTimeline = liveTimeline
        .filter(t => t.day_index <= sim.day)
        .slice(-14);
      const timelineWindow = visibleTimeline.length > 1 ? visibleTimeline : liveTimeline.slice(0, Math.min(14, liveTimeline.length));

      return timelineWindow.map((t, index) => ({
        time: `Day ${t.day_index}`,
        trustScore: Math.round(t.trust_score),
        riskScore: Math.round(t.risk_score),
        event: t.risk_score > 70 ? `Risk spike: ${Math.round(t.risk_score)}` : null,
        live: index === timelineWindow.length - 1,
      }));
    }

    const dayWave = Math.sin(sim.day * 0.2);
    const currentTrust = trustScore;
    return privilegeDecayTimeline.map((point, index) => {
      const progress = index / Math.max(privilegeDecayTimeline.length - 1, 1);
      const baseline = 94 - progress * (94 - currentTrust);
      const movement = Math.sin(sim.day * 0.18 + index * 0.55) * (1.4 + progress * 2.2);
      const trust = Math.max(8, Math.min(98, baseline + movement + dayWave * 1.2));
      const event = progress > 0.65 && trust < 55
        ? point.event?.replace('ALERT: ', '') || `Trust pressure: ${Math.round(100 - trust)}`
        : point.event;
      return {
        ...point,
        trustScore: Math.round(trust),
        riskScore: Math.round(100 - trust),
        event,
        live: index === privilegeDecayTimeline.length - 1,
      };
    });
  }, [liveTimeline, sim.day, trustScore]);

  // Activity feed from API or fallback
  const activityData = liveActivity.length > 0
    ? liveActivity.map((evt, i) => ({
        id: evt.event_id || `evt_${i}`,
        timestamp: new Date(evt.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        employeeId: evt.emp_id,
        employeeName: evt.emp_id,
        actionType: evt.action_type,
        system: evt.system,
        detail: `${evt.action_type.replace(/_/g, ' ')} on ${evt.system}`,
        riskContribution: evt.is_after_hours ? 65 : evt.is_new_device ? 55 : 10,
        icon: evt.action_type.includes('login') ? '🔑' : evt.is_after_hours ? '🌙' : '🔍',
      }))
    : activityFeed.filter(e => e.employeeId === id).slice(0, 10);

  function getTrustLevel(score: number) {
    if (score < 20) return 'CRITICAL';
    if (score < 40) return 'HIGH_RISK';
    if (score < 60) return 'MEDIUM_RISK';
    if (score < 80) return 'LOW_RISK';
    return 'TRUSTED';
  }

  if (!mockEmp && !liveDetail) {
    return (
      <AppShell title="Employee" subtitle="Not found">
        <div className="empty-state" style={{ padding: 60 }}>
          <h2 style={{ marginBottom: 12 }}>Employee not found</h2>
          <Link href="/employees">← Back to employees</Link>
        </div>
      </AppShell>
    );
  }

  const color = getTrustColor(trustScore);
  const trustLevel = getTrustLevel(trustScore);
  const activeTwinDrift = twinDrift || Math.min(1, twinDimensions.reduce((sum, d) => sum + Math.abs(d.actual - d.expected), 0) / (twinDimensions.length * 100));

  const genomeRows = [
    {
      label: 'Login time',
      icon: Clock,
      expected: sampleTwinProfile.expectedLogin,
      actual: sampleTwinProfile.actualLogin,
      delta: sampleTwinProfile.expectedLogin === sampleTwinProfile.actualLogin ? 'Aligned' : 'Changed',
      severity: sampleTwinProfile.expectedLogin === sampleTwinProfile.actualLogin ? 'low' : 'medium',
    },
    {
      label: 'Records accessed',
      icon: Database,
      expected: `${sampleTwinProfile.expectedRecords}/day`,
      actual: `${sampleTwinProfile.actualRecords}/day`,
      delta: `${Math.round(sampleTwinProfile.actualRecords / sampleTwinProfile.expectedRecords)}x baseline`,
      severity: sampleTwinProfile.actualRecords > sampleTwinProfile.expectedRecords * 5 ? 'high' : 'medium',
    },
    {
      label: 'Data volume',
      icon: HardDrive,
      expected: `${sampleTwinProfile.expectedDataVolume} MB`,
      actual: `${sampleTwinProfile.actualDataVolume} MB`,
      delta: `${Math.round(sampleTwinProfile.actualDataVolume / sampleTwinProfile.expectedDataVolume)}x baseline`,
      severity: sampleTwinProfile.actualDataVolume > sampleTwinProfile.expectedDataVolume * 5 ? 'high' : 'medium',
    },
    {
      label: 'Devices used',
      icon: Monitor,
      expected: String(sampleTwinProfile.expectedDevices),
      actual: String(sampleTwinProfile.actualDevices),
      delta: sampleTwinProfile.actualDevices > sampleTwinProfile.expectedDevices ? 'New device' : 'Aligned',
      severity: sampleTwinProfile.actualDevices > sampleTwinProfile.expectedDevices ? 'medium' : 'low',
    },
    {
      label: 'Systems touched',
      icon: Network,
      expected: sampleTwinProfile.expectedSystems.join(', '),
      actual: sampleTwinProfile.actualSystems.join(', '),
      delta: `${sampleTwinProfile.actualSystems.length - sampleTwinProfile.expectedSystems.length} extra`,
      severity: sampleTwinProfile.actualSystems.length > sampleTwinProfile.expectedSystems.length ? 'high' : 'low',
    },
  ];

  // ─── Radar Chart (Twin Comparison) ───
  const radarData = {
    labels: twinDimensions.map(d => d.label),
    datasets: [
      {
        label: 'Expected (Twin)',
        data: twinDimensions.map(d => d.expected),
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 2,
        pointBackgroundColor: '#06b6d4',
        pointRadius: 3,
      },
      {
        label: 'Actual (Current)',
        data: twinDimensions.map(d => d.actual),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 2,
        pointBackgroundColor: '#ef4444',
        pointRadius: 3,
      },
    ],
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 25,
          color: 'rgba(148, 163, 184, 0.3)',
          backdropColor: 'transparent',
          font: { size: 9, family: 'Inter' },
        },
        grid: { color: 'rgba(148, 163, 184, 0.06)' },
        angleLines: { color: 'rgba(148, 163, 184, 0.06)' },
        pointLabels: {
          color: 'rgba(148, 163, 184, 0.7)',
          font: { size: 11, family: 'Inter', weight: 'normal' as const },
        },
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#94a3b8', font: { size: 11, family: 'Inter' }, padding: 16, usePointStyle: true, pointStyleWidth: 8 },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { family: 'Inter', size: 12 },
        bodyFont: { family: 'Inter', size: 11 },
        borderColor: 'rgba(148, 163, 184, 0.1)',
        borderWidth: 1, padding: 10, cornerRadius: 8,
      },
    },
  };

  // ─── Privilege Decay Chart ───
  const latestDecay = decay[decay.length - 1];
  const previousDecay = decay[decay.length - 2];
  const trustDelta = latestDecay && previousDecay ? latestDecay.trustScore - previousDecay.trustScore : 0;

  const decayData = {
    labels: decay.map(d => d.time),
    datasets: [{
      label: 'Trust Score',
      data: decay.map(d => d.trustScore),
      borderColor: '#2563eb',
      backgroundColor: (ctx: any) => {
        if (!ctx.chart?.ctx) return 'rgba(37, 99, 235, 0.1)';
        const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height || 300);
        gradient.addColorStop(0, 'rgba(37, 99, 235, 0.18)');
        gradient.addColorStop(0.55, 'rgba(37, 99, 235, 0.05)');
        gradient.addColorStop(1, 'rgba(185, 28, 28, 0.05)');
        return gradient;
      },
      fill: true,
      tension: 0.35,
      borderWidth: 2.5,
      pointRadius: decay.map(d => d.live ? 6 : d.event ? 4 : 0),
      pointHoverRadius: 7,
      pointBackgroundColor: decay.map(d => d.live ? '#2563eb' : d.trustScore < 30 ? '#b91c1c' : d.trustScore < 60 ? '#b45309' : '#15803d'),
      pointBorderColor: 'var(--surface)',
      pointBorderWidth: 2,
    }],
  };

  const decayOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutQuart' as const },
    interaction: { intersect: false, mode: 'index' as const },
    scales: {
      y: {
        min: 0,
        max: 100,
        grid: { color: 'rgba(120, 113, 108, 0.08)' },
        border: { display: false },
        ticks: { color: '#78716c', font: { size: 11, family: 'IBM Plex Mono' } },
      },
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#78716c', font: { size: 10, family: 'IBM Plex Mono' } },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(28, 25, 23, 0.96)',
        titleFont: { family: 'DM Sans', size: 12 },
        bodyFont: { family: 'DM Sans', size: 11 },
        borderColor: 'rgba(214, 211, 209, 0.18)',
        borderWidth: 1, padding: 12, cornerRadius: 8,
        callbacks: {
          afterBody: (items: any) => {
            const idx = items[0]?.dataIndex;
            const point = decay[idx];
            return point?.event ? `\n${point.event}` : '';
          },
        },
      },
    },
  };

  return (
    <AppShell
      title={empName}
      subtitle={`${empRole} · ${empDept}`}
      headerExtra={
        <>
          <Link href="/employees" className="pill" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={13} /> Back
          </Link>
          <SimulationControl
            day={sim.day} maxDay={sim.maxDay} speed={sim.speed}
            paused={sim.paused} live={sim.live}
            onSetSpeed={sim.setSpeed} onTogglePause={sim.togglePause}
            onReset={sim.reset} onJumpTo={sim.jumpTo}
          />
        </>
      }
    >
      <MockBanner show={isMock} />
          {/* Employee Header Card */}
          <div className={`card ${isHighRisk ? 'card-glow-red' : 'card-glow-cyan'}`} style={{ marginBottom: 24 }}>
            <div style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 24 }}>
              <div className="avatar" style={{ width: 56, height: 56, fontSize: 20, background: mockEmp?.avatarColor || '#06b6d4' }}>
                {empName.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{empName}</div>
                <div className="text-sm text-muted mt-4">
                  {empRole} • {empDept} • {empBranch} • Clearance {empClearance}/5
                </div>
                <div className="text-xs text-muted mt-4 text-mono">{id} • Risk Score: {riskScore}</div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 100 }}>
                <div style={{ fontSize: 42, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.04em' }}>
                  {trustScore}
                </div>
                <div className="text-xs text-muted mt-4">Trust Score</div>
                <div style={{
                  marginTop: 8, padding: '3px 10px', borderRadius: 'var(--radius-full)',
                  background: `${color}15`, color, fontSize: 10, fontWeight: 700,
                  border: `1px solid ${color}30`, textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {trustLevel.replace('_', ' ')}
                </div>
              </div>
            </div>
          </div>

          {/* Two-Column Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Twin Comparison Radar */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Fingerprint size={16} style={{ color: 'var(--cyan-500)' }} />
                  Digital Twin Comparison
                </div>
                <span className="text-xs text-muted">Expected vs Actual</span>
              </div>
              <div className="card-body" style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '100%', maxWidth: 380 }}>
                  <Radar data={radarData} options={radarOptions} />
                </div>
              </div>
            </div>

            {/* SHAP Explainability — NEW */}
            <div className="card" style={{ border: shapData ? '1px solid rgba(139,92,246,0.2)' : undefined }}>
              <div className="card-header">
                <div className="card-title">
                  <Brain size={16} style={{ color: '#8b5cf6' }} />
                  SHAP Explainability
                </div>
                <span className="text-xs text-mono" style={{ color: '#8b5cf6' }}>
                  {shapData ? 'TreeExplainer' : shapLoading ? 'Loading...' : 'Unavailable'}
                </span>
              </div>
              <div className="card-body">
                {shapData ? (
                  <ShapWaterfall shapData={shapData} />
                ) : shapLoading ? (
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <div className="text-sm text-muted">Calculating SHAP values...</div>
                  </div>
                ) : (
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <div className="text-sm text-muted">Start the API server to see SHAP explanations</div>
                    <div className="text-xs text-muted mt-8 text-mono">python -m argus.api.scoring_api</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Gemini AI Analysis */}
          <GeminiReport
            employeeData={{
              emp_id: id,
              name: empName,
              department: empDept,
              role: empRole,
              branch: empBranch,
              clearance_level: empClearance,
              trust_score: trustScore,
              risk_score: riskScore,
            }}
            shapData={shapData}
            alertData={mockAlerts?.[0] ? {
              severity: mockAlerts[0].severity,
              matched_chain: mockAlerts[0].intentChain?.pattern || '',
              chain_confidence: mockAlerts[0].intentChain?.confidence || 0,
              chain_signals: mockAlerts[0].intentChain?.matchedSteps || [],
              top_features: mockAlerts[0].riskFactors?.map((rf: { factor: string; detail: string; impact: number }) => ({
                feature: rf.factor,
                zscore: rf.impact,
                value: rf.impact,
              })) || [],
              summary: mockAlerts[0].riskFactors?.map((rf: { detail: string }) => rf.detail).join('; ') || '',
            } : null}
          />

          {/* Behavioral Genome Deviation */}
          <div className="employee-genome mt-24">
            <div className="employee-genome-header">
              <div>
                <div className="employee-detail-kicker">Twin deviation</div>
                <h2>Behavioral Genome Deviation</h2>
                <p>Expected baseline compared with the latest observed behavior.</p>
              </div>
              <div className={`employee-drift-pill ${activeTwinDrift > 0.45 ? 'employee-drift-pill--risk' : ''}`}>
                <Cpu size={14} />
                Drift {activeTwinDrift.toFixed(2)}
              </div>
            </div>

            <div className="employee-genome-grid">
              {genomeRows.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`employee-genome-row employee-genome-row--${item.severity}`}>
                    <div className="employee-genome-metric">
                      <span className="employee-genome-icon">
                        <Icon size={15} />
                      </span>
                      <span>{item.label}</span>
                    </div>
                    <div className="employee-genome-value">
                      <span>Expected</span>
                      <strong>{item.expected}</strong>
                    </div>
                    <div className="employee-genome-value">
                      <span>Actual</span>
                      <strong>{item.actual}</strong>
                    </div>
                    <div className="employee-genome-delta">{item.delta}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Privilege Decay Chart — Full Width */}
          <div className="employee-timeline-card mt-24">
            <div className="employee-timeline-header">
              <div>
                <div className="employee-detail-kicker">Live trust movement</div>
                <h2>Privilege Decay Timeline</h2>
              </div>
              <div className="employee-timeline-chip">
                <TrendingDown size={14} />
                {liveTimeline.length > 0 ? `${liveTimeline.length} live days` : `Sim day ${sim.day}`}
              </div>
            </div>
            <div className="employee-timeline-livebar">
              <div>
                <span>Current trust</span>
                <strong>{latestDecay?.trustScore ?? trustScore}</strong>
              </div>
              <div>
                <span>Last movement</span>
                <strong className={trustDelta < 0 ? 'employee-timeline-drop' : ''}>
                  {trustDelta > 0 ? '+' : ''}{trustDelta}
                </strong>
              </div>
              <div>
                <span>Window</span>
                <strong>{decay.length} points</strong>
              </div>
            </div>
            <div className="employee-timeline-body">
              <Line data={decayData} options={decayOptions} />
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="card mt-24">
            <div className="card-header">
              <div className="card-title">
                <Clock size={16} style={{ color: 'var(--cyan-500)' }} />
                Activity Timeline
              </div>
            </div>
            <div className="card-body" style={{ padding: '8px 20px 20px' }}>
              {activityFeed.filter(a => a.employeeId === id || (isHighRisk && a.riskContribution > 60)).slice(0, 8).map((event) => {
                const riskLevel = event.riskContribution > 70 ? 'high' : event.riskContribution > 30 ? 'medium' : 'low';
                return (
                  <div key={event.id} className="feed-item">
                    <span className="feed-time">{event.timestamp}</span>
                    <span className="feed-icon">{event.icon}</span>
                    <div className="feed-content">
                      <span className="feed-employee">{event.employeeName}</span>{' '}
                      <span className="feed-detail">{event.detail}</span>
                    </div>
                    <span className={`feed-risk ${riskLevel}`}>{event.riskContribution}</span>
                  </div>
                );
              })}
            </div>
          </div>
    </AppShell>
  );
}
