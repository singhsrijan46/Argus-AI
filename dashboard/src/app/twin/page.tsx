'use client';

import AppShell from '@/components/AppShell';
import MockBanner from '@/components/MockBanner';
import SimulationControl from '@/components/SimulationControl';
import {
  employees as mockEmployeesData, getTrustColor,
  type Employee,
} from '@/lib/mockData';
import { useEmployees, useSimulation } from '@/lib/hooks';
import {
  ArrowRight, BarChart3, Clock3, Fingerprint, Gauge, GitBranch,
  ShieldCheck, TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

export default function TwinPage() {
  const sim = useSimulation();
  const { data: liveEmployees, isMock } = useEmployees('trust_score', 'asc');

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
          avatarColor: ['#475569','#2563eb','#b45309','#15803d','#b91c1c','#7c3aed','#64748b','#0f766e','#c2410c','#4f46e5'][i % 10],
          isInsider: e.is_insider || false,
          lastActive: 'Live',
          twinDrift: e.twin_drift || 0,
        }))
      : mockEmployeesData
  ), [liveEmployees]);

  const highRiskEmployees = employees.filter(e => e.twinDrift > 0.3).sort((a, b) => b.twinDrift - a.twinDrift);
  const normalEmployees = employees.filter(e => e.twinDrift <= 0.3).sort((a, b) => b.twinDrift - a.twinDrift);
  const averageDrift = employees.length
    ? employees.reduce((sum, emp) => sum + emp.twinDrift, 0) / employees.length
    : 0;

  const twinDimensions = [
    { icon: Clock3, label: 'Circadian profile', dim: '8 dim', desc: 'Login rhythm and shift timing' },
    { icon: GitBranch, label: 'Access graph', dim: '16 dim', desc: 'Systems and resource pathways' },
    { icon: BarChart3, label: 'Behavior baseline', dim: '94 dim', desc: 'Rolling feature averages' },
    { icon: TrendingUp, label: 'Drift velocity', dim: '1 dim', desc: 'Rate of behavioral change' },
  ];

  return (
    <AppShell
      title="Digital twins"
      subtitle="Expected vs actual behavior profiles"
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

      <section className="twin-hero mb-24">
        <div className="twin-hero-main">
          <div className="twin-hero-copy">
            <div className="twin-kicker">Behavior model</div>
            <h2>What is a Digital Employee Twin?</h2>
            <p>
              A digital twin is a compact baseline of how an employee normally works. It compares current
              activity against expected login timing, access patterns, data movement, and drift speed so
              unusual changes surface early.
            </p>
          </div>
          <div className="twin-hero-score">
            <span>Average drift</span>
            <strong>{averageDrift.toFixed(2)}</strong>
            <small>Day {sim.day}</small>
          </div>
        </div>

        <div className="twin-dimension-grid">
          {twinDimensions.map(({ icon: Icon, label, dim, desc }) => (
            <div key={label} className="twin-dimension-card">
              <div className="twin-dimension-icon">
                <Icon size={17} />
              </div>
              <div>
                <div className="twin-dimension-title">{label}</div>
                <div className="twin-dimension-meta">{dim}</div>
                <div className="twin-dimension-desc">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="twin-summary-grid mb-24">
        <div className="twin-summary-card">
          <ShieldCheck size={18} />
          <span>Stable twins</span>
          <strong>{normalEmployees.length}</strong>
        </div>
        <div className="twin-summary-card twin-summary-card--warn">
          <Gauge size={18} />
          <span>High drift</span>
          <strong>{highRiskEmployees.length}</strong>
        </div>
        <div className="twin-summary-card">
          <Fingerprint size={18} />
          <span>Profiles monitored</span>
          <strong>{employees.length}</strong>
        </div>
      </div>

      <div className="twin-section-heading mb-16">
        <div>
          <h3>High Drift Employees</h3>
          <p>Significant behavioral deviation from baseline · Day {sim.day}</p>
        </div>
      </div>

      {highRiskEmployees.length === 0 ? (
        <div className="twin-empty mb-24">
          <ShieldCheck size={24} />
          <div>
            <strong>No high-drift employees at Day {sim.day}</strong>
            <p>Behavioral patterns are within expected baseline ranges.</p>
          </div>
        </div>
      ) : (
        <div className="twin-risk-grid">
          {highRiskEmployees.map((emp) => {
            const color = getTrustColor(emp.trustScore);
            const initials = emp.name.split(' ').map(n => n[0]).join('');
            return (
              <Link href={`/employee/${emp.id}`} key={emp.id} className="twin-risk-card">
                <div className="twin-employee-row">
                  <div className="avatar" style={{ background: emp.avatarColor }}>{initials}</div>
                  <div className="twin-employee-copy">
                    <div className="twin-employee-name">{emp.name}</div>
                    <div className="twin-employee-meta">{emp.department} · {emp.role}</div>
                  </div>
                  <div className="twin-trust-value" style={{ color }}>{emp.trustScore}</div>
                </div>
                <div className="twin-drift-block">
                  <div className="twin-drift-label">
                    <span>Twin drift</span>
                    <strong>{emp.twinDrift.toFixed(2)}</strong>
                  </div>
                  <div className="twin-drift-track">
                    <span
                      className="twin-drift-fill twin-drift-fill--risk"
                      style={{ width: `${Math.min(emp.twinDrift * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="twin-card-footer">
                  <span>View employee profile</span>
                  <ArrowRight size={14} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="twin-section-heading mb-16">
        <div>
          <h3>Stable Twins</h3>
          <p>Behavior within expected range</p>
        </div>
      </div>

      <div className="twin-stable-grid">
        {normalEmployees.slice(0, 12).map((emp) => {
          const color = getTrustColor(emp.trustScore);
          const initials = emp.name.split(' ').map(n => n[0]).join('');
          return (
            <Link href={`/employee/${emp.id}`} key={emp.id} className="twin-stable-card">
              <div className="twin-employee-row">
                <div className="avatar avatar-sm" style={{ background: emp.avatarColor }}>{initials}</div>
                <div className="twin-employee-copy">
                  <div className="twin-employee-name truncate">{emp.name}</div>
                  <div className="twin-employee-meta">{emp.department}</div>
                </div>
                <div className="twin-trust-value twin-trust-value--sm" style={{ color }}>{emp.trustScore}</div>
              </div>
              <div className="twin-drift-track twin-drift-track--small">
                <span
                  className="twin-drift-fill"
                  style={{ width: `${Math.min(emp.twinDrift * 100, 100)}%` }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
