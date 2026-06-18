'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import MissionTimeBar from '@/components/MissionTimeBar';
import MockBanner from '@/components/MockBanner';
import StatCard from '@/components/StatCard';
import Panel from '@/components/Panel';
import AnimatedNumber from '@/components/AnimatedNumber';
import {
  employees as mockEmployees, alerts as mockAlerts, activityFeed as mockActivityFeed,
  modelMetrics as mockMetrics, departmentStats as mockDeptStats, getTrustColor,
  type Employee,
} from '@/lib/mockData';
import { useOverview, useEmployees, useAlerts, useSimulation, useActivity, useAnalytics } from '@/lib/hooks';
import { useTheme } from '@/lib/ThemeContext';
import {
  Shield, AlertTriangle, Users, TrendingDown,
  ArrowDownRight, ArrowUpRight, Zap, Eye, Activity,
  AlertCircle,
} from 'lucide-react';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

function TrustDistribution({ employees: empList }: { employees: Employee[] }) {
  const { isDark } = useTheme();
  const levels = [
    { label: 'Trusted', count: empList.filter(e => e.trustScore >= 80).length, color: '#2563eb' },
    { label: 'Low Risk', count: empList.filter(e => e.trustScore >= 60 && e.trustScore < 80).length, color: '#16a34a' },
    { label: 'Medium', count: empList.filter(e => e.trustScore >= 40 && e.trustScore < 60).length, color: '#d97706' },
    { label: 'High Risk', count: empList.filter(e => e.trustScore >= 20 && e.trustScore < 40).length, color: '#ea580c' },
    { label: 'Critical', count: empList.filter(e => e.trustScore < 20).length, color: '#dc2626' },
  ];

  return (
    <div className="donut-wrapper">
      <Doughnut
        data={{
          labels: levels.map(l => l.label),
          datasets: [{
            data: levels.map(l => l.count),
            backgroundColor: levels.map(l => l.color),
            borderWidth: 2,
            borderColor: isDark ? '#171717' : '#ffffff',
            hoverOffset: 4,
          }],
        }}
        options={{
          cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'var(--chart-tooltip-bg)',
              titleColor: 'var(--text)',
              bodyColor: 'var(--text-secondary)',
              borderColor: 'var(--chart-tooltip-border)',
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
            },
          },
        }}
      />
      <div className="donut-center">
        <span className="donut-center-value">{empList.length}</span>
        <span className="donut-center-label">Total</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const sim = useSimulation();
  const { data: overview, isMock: overviewMock } = useOverview();
  const { data: liveEmployees, isMock: empMock } = useEmployees('trust_score', 'asc');
  const { data: liveAlerts } = useAlerts(10);
  const { data: liveActivity, isMock: activityMock } = useActivity(undefined, 15);
  const { data: analytics } = useAnalytics();

  const isMock = overviewMock || empMock;

  const employees: Employee[] = useMemo(() => {
    const rawList = liveEmployees.length > 0 ? liveEmployees : mockEmployees;
    return rawList.map((e, i) => {
      // In demo mode, apply a tiny deterministic drift based on simulation day
      // so that the heatmap cells actually morph and change color/values as days tick!
      let score = 'trustScore' in e ? e.trustScore : Math.round((e as any).trust_score ?? 95);
      if (liveEmployees.length === 0) {
        const seed = Math.sin(i * 12.34 + sim.day * 5.67);
        const drift = Math.round(seed * 5);
        score = Math.max(10, Math.min(100, score + drift));
      }
      const previousScore = Math.max(10, Math.min(100, score + 5));

      return {
        id: 'id' in e ? e.id : (e as any).emp_id,
        name: e.name,
        department: e.department,
        role: e.role,
        branch: e.branch,
        clearanceLevel: 'clearanceLevel' in e ? e.clearanceLevel : (e as any).clearance_level || 1,
        tenureMonths: 'tenureMonths' in e ? e.tenureMonths : 0,
        trustScore: score,
        previousTrustScore: previousScore,
        trustLevel: score < 20 ? 'CRITICAL' as const : score < 40 ? 'HIGH_RISK' as const : score < 60 ? 'MEDIUM_RISK' as const : score < 80 ? 'LOW_RISK' as const : 'TRUSTED' as const,
        avatarColor: 'avatarColor' in e ? e.avatarColor : ['#2563eb','#7c3aed','#d97706','#16a34a','#dc2626','#db2777','#0891b2','#0d9488','#ea580c','#4f46e5'][i % 10],
        isInsider: 'isInsider' in e ? e.isInsider : (e as any).is_insider || false,
        lastActive: 'lastActive' in e ? e.lastActive : 'Live',
        twinDrift: 'twinDrift' in e ? e.twinDrift : (e as any).twin_drift || 0,
      };
    });
  }, [liveEmployees, sim.day]);

  const modelMetrics = useMemo(() => {
    if (overview) {
      return {
        f1: overview.model_f1,
        precision: 0,
        recall: 0,
        aucRoc: overview.model_auc,
        falsePositiveRate: overview.model_fpr,
        alertsToday: overview.active_threats,
        employeesMonitored: overview.total_employees,
        threatsDetected: overview.active_threats,
      };
    }
    const dayFactor = Math.sin(sim.day * 0.15);
    const threats = Math.max(1, Math.round(5 + dayFactor * 3));
    return {
      f1: 0.945 + dayFactor * 0.005,
      precision: 0.92,
      recall: 0.91,
      aucRoc: 0.983 + dayFactor * 0.003,
      falsePositiveRate: 0.012 - dayFactor * 0.002,
      alertsToday: threats,
      employeesMonitored: 200,
      threatsDetected: threats,
    };
  }, [overview, sim.day]);

  const alerts = useMemo(() => (
    liveAlerts.length > 0 ? liveAlerts.map((a, i) => ({
      id: `ALT_${i}`,
      employeeId: a.emp_id,
      employeeName: a.name,
      department: a.department,
      trustScore: Math.round(a.trust_score),
      previousTrustScore: Math.round(a.trust_score + 20),
      trustLevel: (a.trust_score < 20 ? 'CRITICAL' : a.trust_score < 40 ? 'HIGH_RISK' : a.trust_score < 60 ? 'MEDIUM_RISK' : 'LOW_RISK') as 'CRITICAL' | 'HIGH_RISK' | 'MEDIUM_RISK' | 'LOW_RISK',
      timestamp: new Date().toISOString(),
      severity: a.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM',
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

  const departmentStats = useMemo(() => {
    if (analytics?.department_stats && analytics.department_stats.length > 0) {
      const colors = ['#2563eb', '#7c3aed', '#d97706', '#16a34a', '#db2777', '#0891b2', '#0d9488'];
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

  const activityFeedData = useMemo(() => {
    if (liveActivity.length > 0) {
      return liveActivity.slice(0, 10).map((evt, i) => {
        const emp = employees.find(e => e.id === evt.emp_id);
        const name = emp ? emp.name : evt.emp_id;
        return {
          id: evt.event_id || `evt_${i}`,
          timestamp: new Date(evt.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
          employeeId: evt.emp_id,
          employeeName: name,
          icon: evt.is_after_hours ? '🌙' : evt.is_new_device ? '🔌' : evt.action_type.includes('usb') ? '💾' : evt.action_type.includes('email') ? '📧' : '🔍',
          detail: `${evt.action_type.replace(/_/g, ' ')} on ${evt.system}`,
          riskContribution: evt.is_after_hours ? 75 : evt.is_new_device ? 60 : evt.records_accessed > 50 ? 45 : 10,
        };
      });
    }
    return mockActivityFeed;
  }, [liveActivity, employees]);

  const currentTime = sim.serverTime || '--:--:--';
  const sortedEmployees = [...employees].sort((a, b) => a.trustScore - b.trustScore);
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');

  return (
    <AppShell
      title="Overview"
      subtitle="Insider threat monitoring across your organization"
    >
      <MockBanner show={isMock} />

      <MissionTimeBar
        serverTime={currentTime}
        day={sim.day}
        maxDay={sim.maxDay}
        speed={sim.speed}
        paused={sim.paused}
        live={sim.live}
        criticalCount={criticalAlerts.length}
        isDemo={isMock}
        onSetSpeed={sim.setSpeed}
        onTogglePause={sim.togglePause}
        onReset={sim.reset}
        onJumpTo={sim.jumpTo}
      />

      <div className="metrics-grid">
        <StatCard
          label="Employees"
          icon={Users}
          variant="blue"
          delay={0}
          value={<AnimatedNumber value={modelMetrics.employeesMonitored} />}
          hint={<><ArrowUpRight size={13} /> All departments</>}
          hintTone="up"
          href="/employees"
        />
        <StatCard
          label="Active threats"
          icon={AlertTriangle}
          variant="red"
          delay={0.06}
          value={<AnimatedNumber value={modelMetrics.threatsDetected} />}
          hint={<><ArrowDownRight size={13} /> {criticalAlerts.length} critical</>}
          hintTone="down"
          href="/alerts"
        />
        <StatCard
          label="Model F1"
          icon={Zap}
          variant="violet"
          delay={0.12}
          value={<AnimatedNumber value={modelMetrics.f1 * 100} decimals={1} suffix="%" />}
          hint={<><ArrowUpRight size={13} /> AUC {(modelMetrics.aucRoc * 100).toFixed(1)}%</>}
          hintTone="up"
          href="/analytics"
        />
        <StatCard
          label="False positive rate"
          icon={Shield}
          variant="green"
          delay={0.18}
          value={<AnimatedNumber value={modelMetrics.falsePositiveRate * 100} decimals={1} suffix="%" />}
          hint={<><ArrowUpRight size={13} /> Below 2% target</>}
          hintTone="up"
          href="/analytics"
        />
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-col">
          {/* Employee Trust Heatmap */}
          <Panel
            title="Employee Trust Heatmap"
            icon={Eye}
            delay={0.1}
            badge={<span className="text-xs text-muted">{employees.length} people · Day {sim.day}</span>}
          >
            <div className="heatmap-grid">
              {sortedEmployees.map((emp) => {
                const color = getTrustColor(emp.trustScore);
                const initials = emp.name.split(' ').map(n => n[0]).join('');
                return (
                  <Link
                    key={emp.id}
                    href={`/employee/${emp.id}`}
                    className={`heatmap-cell ${emp.trustScore < 30 ? 'pulse-alert' : ''}`}
                    style={{
                      background: `color-mix(in srgb, ${color} 18%, var(--surface))`,
                      borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
                      color: color,
                      textDecoration: 'none',
                    }}
                    title={`${emp.name} — ${emp.trustScore}`}
                  >
                    <span className="heatmap-cell-initials">{initials}</span>
                    <span className="heatmap-cell-score">{emp.trustScore}</span>
                  </Link>
                );
              })}
            </div>
            <div className="legend-row">
              {[
                { label: 'Critical', color: '#e5625e' },
                { label: 'High', color: '#f19c79' },
                { label: 'Medium', color: '#ecd389' },
                { label: 'Low', color: '#8eb897' },
                { label: 'Trusted', color: '#6c809a' },
              ].map(l => (
                <span key={l.label} className="legend-item">
                  <span className="legend-dot" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </Panel>
        </div>

        <div className="dashboard-col">
          {/* Alerts Panel */}
          <Panel
            title="Alerts"
            icon={AlertTriangle}
            variant="danger"
            delay={0.12}
            noPadding
            badge={<span className="badge badge--critical">{alerts.length} active</span>}
          >
            <div className="alerts-container">
              {alerts.length === 0 ? (
                <div className="empty-state">
                  <Shield size={28} style={{ opacity: 0.25, margin: '0 auto 8px', display: 'block' }} />
                  No alerts at day {sim.day}
                </div>
              ) : alerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={`/employee/${alert.employeeId}`}
                  className={`alert-item severity-${alert.severity}`}
                  style={{ textDecoration: 'none' }}
                >
                  <span className="alert-card-icon">
                    <AlertCircle size={16} />
                  </span>
                  <div className="alert-card-copy">
                    <div className="alert-card-head">
                      <span className="alert-name">{alert.employeeName}</span>
                      <span className={`badge badge--${alert.severity.toLowerCase()}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <div className="alert-meta">
                      <span>{alert.department}</span>
                      {alert.riskFactors[0]?.factor && <span>{alert.riskFactors[0].factor}</span>}
                    </div>
                    {alert.intentChain && (
                      <div className="alert-intent">
                        {alert.intentChain.pattern} ({(alert.intentChain.confidence * 100).toFixed(0)}%)
                      </div>
                    )}
                  </div>
                  <span className="alert-score" style={{ color: getTrustColor(alert.trustScore) }}>
                    <strong>{alert.trustScore}</strong>
                    <small>trust</small>
                  </span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Grid 2: Secondary summaries (Timeline Feed, Department stats, Highest Risk) */}
      <div className="dashboard-grid-3 mt-24">
        {/* Trust by Department */}
        <Panel title="Trust by department" icon={Shield} delay={0.15}>
          <TrustDistribution employees={employees} />
          <div className="mt-16">
            {departmentStats.map((dept) => {
              const c = getTrustColor(dept.avgTrust);
              return (
                <div key={dept.name} className="dept-row">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                      <span className="legend-dot" style={{ background: dept.color }} />
                      <span className="text-sm font-semibold">{dept.name}</span>
                    </div>
                    <div className="flex items-center gap-12">
                      <span className="text-xs text-muted">{dept.employees}</span>
                      <span className="text-mono font-semibold text-sm" style={{ color: c }}>{dept.avgTrust.toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="dept-progress-bar">
                    <div className="dept-progress-fill" style={{ width: `${dept.avgTrust}%`, background: c }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Highest Risk */}
        <Panel title="Highest risk" icon={TrendingDown} delay={0.18} noPadding>
          {sortedEmployees.slice(0, 5).map((emp) => (
            <Link
              key={emp.id}
              href={`/employee/${emp.id}`}
              className="risk-row"
              style={{ textDecoration: 'none' }}
            >
              <div className="avatar avatar-sm" style={{ background: emp.avatarColor }}>
                {emp.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-sm font-semibold truncate">{emp.name}</div>
                <div className="text-xs text-muted">{emp.department}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="text-mono font-bold text-sm" style={{ color: getTrustColor(emp.trustScore) }}>
                  {emp.trustScore}
                </div>
                {emp.twinDrift > 0.01 && (
                  <div className="text-xs text-muted">drift {(emp.twinDrift * 100).toFixed(1)}%</div>
                )}
              </div>
            </Link>
          ))}
        </Panel>

        {/* Activity Feed Panel */}
        <Panel
          title="Activity feed"
          icon={Activity}
          delay={0.22}
          noPadding
          badge={
            <span className={`pill ${activityMock ? '' : 'pill--live'}`}>
              {!activityMock && <span className="pill-dot" />}
              {activityMock ? 'Demo' : 'Live'}
            </span>
          }
        >
          <div className="feed-container">
            {activityFeedData.map((event) => {
              const risk = event.riskContribution > 70 ? 'high' : event.riskContribution > 30 ? 'medium' : 'low';
              const targetEmpId = event.employeeId || event.employeeName;
              return (
                <Link
                  key={event.id}
                  href={`/employee/${targetEmpId}`}
                  className="feed-item"
                  style={{ textDecoration: 'none' }}
                >
                  <span className="feed-time">{event.timestamp}</span>
                  <span className="feed-icon-bubble">{event.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="feed-employee font-semibold">{event.employeeName}</span>{' '}
                    <span className="feed-detail">{event.detail}</span>
                  </div>
                  <span className={`feed-risk ${risk}`}>{event.riskContribution}</span>
                </Link>
              );
            })}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
