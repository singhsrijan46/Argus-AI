'use client';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import SimulationControl from '@/components/SimulationControl';
import MockBanner from '@/components/MockBanner';
import {
  employees as mockEmployees, alerts as mockAlerts, activityFeed as mockActivityFeed,
  modelMetrics as mockMetrics, departmentStats as mockDeptStats, getTrustColor,
  type Employee,
} from '@/lib/mockData';
import { useOverview, useEmployees, useAlerts, useSimulation, useActivity, useAnalytics } from '@/lib/hooks';
import {
  Shield, AlertTriangle, Users, TrendingDown,
  ArrowDownRight, ArrowUpRight, Zap, Eye,
  Activity, Clock
} from 'lucide-react';
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, PointElement, LineElement, Filler,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler);

// ─── Animated Counter ────────────────────────────────────────────

function AnimatedCounter({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1200;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(current);
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toFixed(decimals)}{suffix}</>;
}

// ─── Mini Sparkline ──────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 28;
  const w = 80;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="sparkline-container">
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
      <polygon
        fill={`url(#grad-${color.replace('#','')})`}
        points={`0,${h} ${points} ${w},${h}`}
      />
    </svg>
  );
}

// ─── Trust Level Distribution Donut ──────────────────────────────

function TrustDistribution({ employees: empList }: { employees: Employee[] }) {
  const levels = [
    { label: 'Trusted', count: empList.filter(e => e.trustScore >= 80).length, color: '#06b6d4' },
    { label: 'Low Risk', count: empList.filter(e => e.trustScore >= 60 && e.trustScore < 80).length, color: '#22c55e' },
    { label: 'Medium', count: empList.filter(e => e.trustScore >= 40 && e.trustScore < 60).length, color: '#eab308' },
    { label: 'High Risk', count: empList.filter(e => e.trustScore >= 20 && e.trustScore < 40).length, color: '#f97316' },
    { label: 'Critical', count: empList.filter(e => e.trustScore < 20).length, color: '#ef4444' },
  ];

  const data = {
    labels: levels.map(l => l.label),
    datasets: [{
      data: levels.map(l => l.count),
      backgroundColor: levels.map(l => l.color),
      borderWidth: 0,
      hoverOffset: 4,
    }],
  };

  return (
    <div style={{ width: 180, height: 180, margin: '0 auto' }}>
      <Doughnut
        data={data}
        options={{
          cutout: '72%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              titleFont: { family: 'Inter', size: 12 },
              bodyFont: { family: 'Inter', size: 11 },
              borderColor: 'rgba(148, 163, 184, 0.1)',
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
            },
          },
        }}
      />
    </div>
  );
}

// ─── Main Dashboard Page ─────────────────────────────────────────

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState('');

  // ─── Live hooks ───
  const sim = useSimulation();
  const { data: overview, isMock: overviewMock } = useOverview();
  const { data: liveEmployees, isMock: empMock } = useEmployees('trust_score', 'asc');
  const { data: liveAlerts, isMock: alertsMock } = useAlerts(10);
  const { data: liveActivity, isMock: activityMock } = useActivity(undefined, 15);
  const { data: analytics, isMock: analyticsMock } = useAnalytics();

  const isMock = overviewMock || empMock;

  // Build employee list from API or fallback
  const employees: Employee[] = useMemo(() => (
    liveEmployees.length > 0
      ? liveEmployees.map((e, i) => ({
          id: e.emp_id,
          name: e.name || e.emp_id,
          department: e.department || '',
          role: e.role || '',
          branch: e.branch || '',
          clearanceLevel: e.clearance_level || 1,
          tenureMonths: 0,
          trustScore: Math.round(e.trust_score ?? 95),
          previousTrustScore: Math.round((e.trust_score ?? 95) + 5),
          trustLevel: (e.trust_score ?? 95) < 20 ? 'CRITICAL' as const : (e.trust_score ?? 95) < 40 ? 'HIGH_RISK' as const : (e.trust_score ?? 95) < 60 ? 'MEDIUM_RISK' as const : (e.trust_score ?? 95) < 80 ? 'LOW_RISK' as const : 'TRUSTED' as const,
          avatarColor: ['#06b6d4','#8b5cf6','#f59e0b','#10b981','#ef4444','#ec4899','#3b82f6','#14b8a6','#f97316','#6366f1'][i % 10],
          isInsider: e.is_insider || false,
          lastActive: 'Live',
          twinDrift: e.twin_drift || 0,
        }))
      : mockEmployees
  ), [liveEmployees]);

  // Use live model metrics if available
  const modelMetrics = overview ? {
    f1: overview.model_f1,
    precision: 0,
    recall: 0,
    aucRoc: overview.model_auc,
    falsePositiveRate: overview.model_fpr,
    alertsToday: overview.active_threats,
    employeesMonitored: overview.total_employees,
    threatsDetected: overview.active_threats,
  } : mockMetrics;

  // Use live alerts or mock
  const alerts = useMemo(() => (
    liveAlerts.length > 0 ? liveAlerts.map((a, i) => ({
      id: `ALT_${i}`,
      employeeId: a.emp_id,
      employeeName: a.name,
      department: a.department,
      trustScore: Math.round(a.trust_score),
      previousTrustScore: Math.round(a.trust_score + 20),
      trustLevel: (a.trust_score < 20 ? 'CRITICAL' : a.trust_score < 40 ? 'HIGH_RISK' : a.trust_score < 60 ? 'MEDIUM_RISK' : 'LOW_RISK') as any,
      timestamp: new Date().toISOString(),
      severity: a.severity as any,
      status: 'active' as const,
      riskFactors: a.top_features?.slice(0, 3).map(f => ({
        factor: f.feature.replace(/_/g, ' '),
        detail: `Z-score: ${f.zscore?.toFixed(1) || 'N/A'}`,
        impact: -Math.round(a.risk_score / 4),
        icon: '⚠️',
      })) || [],
      intentChain: a.matched_chain ? {
        pattern: a.matched_chain,
        confidence: a.chain_confidence,
        matchedSteps: a.chain_signals || [],
      } : null,
    })) : mockAlerts
  ), [liveAlerts]);

  // Department stats from live analytics or fallback
  const departmentStats = useMemo(() => {
    if (analytics?.department_stats && analytics.department_stats.length > 0) {
      const colors = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#14b8a6'];
      return analytics.department_stats.map((d, i) => ({
        name: d.department.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        employees: d.count,
        avgTrust: d.avg_trust,
        alerts: 0,
        color: colors[i % colors.length],
      }));
    }
    return mockDeptStats;
  }, [analytics]);

  // Activity feed from live API or mock
  const activityFeedData = useMemo(() => {
    if (liveActivity.length > 0) {
      return liveActivity.slice(0, 10).map((evt, i) => ({
        id: evt.event_id || `evt_${i}`,
        timestamp: new Date(evt.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        employeeName: evt.emp_id,
        icon: evt.is_after_hours ? '🌙' : evt.is_new_device ? '🔌' : evt.action_type.includes('usb') ? '💾' : evt.action_type.includes('email') ? '📧' : '🔍',
        detail: `${evt.action_type.replace(/_/g, ' ')} on ${evt.system}`,
        riskContribution: evt.is_after_hours ? 75 : evt.is_new_device ? 60 : evt.records_accessed > 50 ? 45 : 10,
      }));
    }
    return mockActivityFeed;
  }, [liveActivity]);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const sortedEmployees = [...employees].sort((a, b) => a.trustScore - b.trustScore);
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');

  return (
    <div className="app-layout">
      <Sidebar day={sim.day} maxDay={sim.maxDay} live={sim.live} />
      <main className="main-content">
        <div className="page-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-title">Command Center</h1>
              <p className="page-subtitle">Real-time insider threat monitoring across all departments</p>
            </div>
            <div className="flex items-center gap-16">
              <SimulationControl
                day={sim.day}
                maxDay={sim.maxDay}
                speed={sim.speed}
                paused={sim.paused}
                live={sim.live}
                onSetSpeed={sim.setSpeed}
                onTogglePause={sim.togglePause}
                onReset={sim.reset}
                onJumpTo={sim.jumpTo}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                <Clock size={14} style={{ color: 'var(--cyan-500)' }} />
                <span className="text-mono text-sm" style={{ color: 'var(--text-secondary)' }}>{currentTime} IST</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse-badge 1.5s infinite' }} />
                <span className="text-sm font-semibold" style={{ color: '#ef4444' }}>{criticalAlerts.length} Critical</span>
              </div>
            </div>
          </div>
        </div>

        <div className="page-content">
          <MockBanner show={isMock} />

          {/* ─── Metric Cards ─── */}
          <div className="metrics-grid">
            <div className="metric-card" style={{ '--metric-accent': '#06b6d4' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-8">
                <span className="metric-label">Employees Monitored</span>
                <Users size={18} style={{ color: 'var(--cyan-500)', opacity: 0.6 }} />
              </div>
              <div className="metric-value accent-cyan"><AnimatedCounter value={modelMetrics.employeesMonitored} /></div>
              <div className="metric-change positive">
                <ArrowUpRight size={14} />
                All departments active
              </div>
            </div>

            <div className="metric-card" style={{ '--metric-accent': '#ef4444' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-8">
                <span className="metric-label">Active Threats</span>
                <AlertTriangle size={18} style={{ color: '#ef4444', opacity: 0.6 }} />
              </div>
              <div className="metric-value" style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                <AnimatedCounter value={modelMetrics.threatsDetected} />
              </div>
              <div className="metric-change negative">
                <ArrowDownRight size={14} />
                {criticalAlerts.length} critical alerts
              </div>
            </div>

            <div className="metric-card" style={{ '--metric-accent': '#8b5cf6' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-8">
                <span className="metric-label">Model F1 Score</span>
                <Zap size={18} style={{ color: '#8b5cf6', opacity: 0.6 }} />
              </div>
              <div className="metric-value"><AnimatedCounter value={modelMetrics.f1 * 100} decimals={1} suffix="%" /></div>
              <div className="metric-change positive">
                <ArrowUpRight size={14} />
                AUC-ROC: {(modelMetrics.aucRoc * 100).toFixed(1)}%
              </div>
            </div>

            <div className="metric-card" style={{ '--metric-accent': '#22c55e' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-8">
                <span className="metric-label">False Positive Rate</span>
                <Shield size={18} style={{ color: '#22c55e', opacity: 0.6 }} />
              </div>
              <div className="metric-value"><AnimatedCounter value={modelMetrics.falsePositiveRate * 100} decimals={1} suffix="%" /></div>
              <div className="metric-change positive">
                <ArrowUpRight size={14} />
                Below 2% target
              </div>
            </div>
          </div>

          {/* ─── Main Grid ─── */}
          <div className="dashboard-grid">
            {/* Left Column */}
            <div className="flex flex-col gap-20">
              {/* Trust Heatmap */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Eye size={16} style={{ color: 'var(--cyan-500)' }} />
                    Employee Trust Heatmap
                  </div>
                  <span className="text-xs text-muted">{employees.length} employees • Day {sim.day}</span>
                </div>
                <div className="card-body">
                  <div className="heatmap-grid">
                    {sortedEmployees.map((emp) => {
                      const bg = getTrustColor(emp.trustScore);
                      const initials = emp.name.split(' ').map(n => n[0]).join('');
                      const isPulsing = emp.trustScore < 30;
                      return (
                        <div
                          key={emp.id}
                          className={`heatmap-cell ${isPulsing ? 'pulse-alert' : ''}`}
                          style={{
                            background: `${bg}22`,
                            border: `1px solid ${bg}40`,
                          }}
                          title={`${emp.name} — Trust: ${emp.trustScore}`}
                        >
                          <span className="heatmap-cell-initials">{initials}</span>
                          <span className="heatmap-cell-score" style={{ color: bg }}>{emp.trustScore}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-16" style={{ padding: '0 4px' }}>
                    <div className="flex items-center gap-12">
                      {[
                        { label: 'Critical', color: '#ef4444' },
                        { label: 'High', color: '#f97316' },
                        { label: 'Medium', color: '#eab308' },
                        { label: 'Low', color: '#22c55e' },
                        { label: 'Trusted', color: '#06b6d4' },
                      ].map(l => (
                        <div key={l.label} className="flex items-center gap-4">
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                          <span className="text-xs text-muted">{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Activity Feed */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Activity size={16} style={{ color: 'var(--cyan-500)' }} />
                    Live Activity Feed
                  </div>
                  <span className="text-xs text-mono" style={{ color: activityMock ? '#f59e0b' : 'var(--trust-low)' }}>
                    {activityMock ? '● MOCK' : '● STREAMING'}
                  </span>
                </div>
                <div className="card-body" style={{ padding: '8px 20px 20px' }}>
                  <div className="feed-container">
                    {activityFeedData.map((event) => {
                      const riskLevel = event.riskContribution > 70 ? 'high' : event.riskContribution > 30 ? 'medium' : 'low';
                      return (
                        <div
                          key={event.id}
                          className="feed-item"
                        >
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
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-20">
              {/* Alert Queue */}
              <div className="card card-glow-red">
                <div className="card-header">
                  <div className="card-title">
                    <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                    Active Alerts
                  </div>
                  <span className="alert-severity-badge CRITICAL">{alerts.length} active</span>
                </div>
                <div className="card-body" style={{ padding: '8px 12px 12px' }}>
                  {alerts.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                      <Shield size={24} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                      No active alerts at Day {sim.day}
                    </div>
                  ) : alerts.map((alert) => (
                    <div key={alert.id} className={`alert-item severity-${alert.severity}`}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex items-center gap-8">
                          <span className={`alert-severity-badge ${alert.severity}`}>{alert.severity}</span>
                          <span className="alert-name">{alert.employeeName}</span>
                        </div>
                        <div className="alert-meta">{alert.department} • {alert.riskFactors[0]?.factor}</div>
                        {alert.intentChain && (
                          <div className="alert-intent">
                            ⛓ {alert.intentChain.pattern} ({(alert.intentChain.confidence * 100).toFixed(0)}%)
                          </div>
                        )}
                      </div>
                      <div className="alert-trust-change" style={{ color: getTrustColor(alert.trustScore) }}>
                        {alert.trustScore}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust Distribution */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Shield size={16} style={{ color: 'var(--cyan-500)' }} />
                    Trust Distribution
                  </div>
                </div>
                <div className="card-body">
                  <TrustDistribution employees={employees} />
                  <div className="mt-16">
                    {departmentStats.map((dept) => (
                      <div key={dept.name} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-center gap-8">
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: dept.color }} />
                          <span className="text-sm">{dept.name}</span>
                        </div>
                        <div className="flex items-center gap-12">
                          <span className="text-xs text-muted">{dept.employees} emp</span>
                          <span className="text-sm font-semibold text-mono" style={{ color: getTrustColor(dept.avgTrust), minWidth: 40, textAlign: 'right' }}>
                            {dept.avgTrust.toFixed(0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top Risk Employees */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <TrendingDown size={16} style={{ color: '#f97316' }} />
                    Highest Risk
                  </div>
                </div>
                <div className="card-body" style={{ padding: '8px 20px 20px' }}>
                  {sortedEmployees.slice(0, 5).map((emp, i) => (
                    <div key={emp.id} className="flex items-center gap-12" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div className="avatar avatar-sm" style={{ background: emp.avatarColor }}>
                        {emp.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="text-sm font-semibold truncate">{emp.name}</div>
                        <div className="text-xs text-muted">{emp.department}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <span className="text-mono font-bold text-sm" style={{ color: getTrustColor(emp.trustScore) }}>
                          {emp.trustScore}
                        </span>
                        {emp.twinDrift !== undefined && emp.twinDrift > 0.01 && (
                          <span className="text-xs" style={{ color: '#f59e0b', fontWeight: 600 }}>
                            drift: {(emp.twinDrift * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
