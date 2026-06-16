'use client';

import Sidebar from '@/components/Sidebar';
import MockBanner from '@/components/MockBanner';
import SimulationControl from '@/components/SimulationControl';
import {
  employees as mockEmployeesData, sampleTwinProfile, getTrustColor,
  type Employee,
} from '@/lib/mockData';
import { useEmployees, useSimulation } from '@/lib/hooks';
import { Eye, Fingerprint, Waves, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import {
  Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

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
          avatarColor: ['#06b6d4','#8b5cf6','#f59e0b','#10b981','#ef4444','#ec4899','#3b82f6','#14b8a6','#f97316','#6366f1'][i % 10],
          isInsider: e.is_insider || false,
          lastActive: 'Live',
          twinDrift: e.twin_drift || 0,
        }))
      : mockEmployeesData
  ), [liveEmployees]);

  const highRiskEmployees = employees.filter(e => e.twinDrift > 0.3).sort((a, b) => b.twinDrift - a.twinDrift);
  const normalEmployees = employees.filter(e => e.twinDrift <= 0.3).sort((a, b) => b.twinDrift - a.twinDrift);

  return (
    <div className="app-layout">
      <Sidebar day={sim.day} maxDay={sim.maxDay} live={sim.live} />
      <main className="main-content">
        <div className="page-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-title">Digital Employee Twins</h1>
              <p className="page-subtitle">Behavioral genome comparison — expected vs actual behavior profiles</p>
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

          {/* Concept Explanation */}
          <div className="card card-glow-cyan mb-24">
            <div className="card-body" style={{ padding: '24px 28px' }}>
              <div className="flex items-center gap-16">
                <div style={{
                  width: 56, height: 56, borderRadius: 'var(--radius-lg)',
                  background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(139,92,246,0.15))',
                  border: '1px solid rgba(6,182,212,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Fingerprint size={28} style={{ color: 'var(--cyan-400)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>What is a Digital Employee Twin?</div>
                  <div className="text-sm text-muted" style={{ lineHeight: 1.6 }}>
                    A <strong style={{ color: 'var(--cyan-400)' }}>Behavioral Genome</strong> — a 119-dimensional compressed representation
                    of each employee&apos;s normal behavior. It captures circadian rhythms (via FFT), access topology,
                    data volume patterns, and behavioral velocity. Current activity is continuously compared against
                    the twin to detect deviations.
                  </div>
                </div>
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 20,
              }}>
                {[
                  { icon: '🕐', label: 'Circadian Profile', dim: '8-dim', desc: 'FFT of login patterns' },
                  { icon: '🔗', label: 'Access Embedding', dim: '16-dim', desc: 'Resource access graph' },
                  { icon: '📊', label: 'Behavioral Baseline', dim: '94-dim', desc: 'Rolling μ/σ of 47 features' },
                  { icon: '📈', label: 'Drift Velocity', dim: '1-dim', desc: 'Rate of change' },
                ].map((c, i) => (
                  <div key={i} style={{
                    padding: '14px 16px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(15,23,42,0.4)', border: '1px solid var(--border-subtle)',
                  }}>
                    <div className="flex items-center gap-8 mb-8">
                      <span style={{ fontSize: 18 }}>{c.icon}</span>
                      <span className="text-sm font-semibold">{c.label}</span>
                    </div>
                    <div className="text-mono text-xs" style={{ color: 'var(--cyan-400)' }}>{c.dim}</div>
                    <div className="text-xs text-muted mt-4">{c.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Drifting Employees */}
          <div className="flex items-center gap-8 mb-16">
            <Waves size={16} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>High Drift Employees</span>
            <span className="text-xs text-muted">— Significant behavioral deviation from twin · Day {sim.day}</span>
          </div>

          {highRiskEmployees.length === 0 ? (
            <div className="card mb-24" style={{ padding: '32px 24px', textAlign: 'center' }}>
              <Eye size={28} style={{ color: '#22c55e', opacity: 0.4, margin: '0 auto 12px' }} />
              <div className="text-sm" style={{ color: '#94a3b8' }}>
                No high-drift employees at Day {sim.day}. Behavioral patterns are within baseline norms.
              </div>
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                Drift will increase as insider threat scenarios ramp up past Day 40.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
              {highRiskEmployees.map((emp) => {
                const color = getTrustColor(emp.trustScore);
                const initials = emp.name.split(' ').map(n => n[0]).join('');
                return (
                  <Link href={`/employee/${emp.id}`} key={emp.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card" style={{
                      padding: 20, borderLeft: `3px solid ${color}`,
                      transition: 'all var(--transition-base)',
                    }}>
                      <div className="flex items-center gap-12 mb-16">
                        <div className="avatar" style={{ background: emp.avatarColor }}>{initials}</div>
                        <div style={{ flex: 1 }}>
                          <div className="font-semibold">{emp.name}</div>
                          <div className="text-xs text-muted">{emp.department} • {emp.role}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="text-mono font-bold" style={{ color, fontSize: 20 }}>{emp.trustScore}</div>
                        </div>
                      </div>
                      <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs text-muted">Twin Drift</span>
                          <span className="text-mono text-xs font-bold" style={{ color: '#ef4444' }}>{emp.twinDrift.toFixed(2)}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.08)' }}>
                          <div style={{
                            height: '100%', borderRadius: 2, width: `${Math.min(emp.twinDrift * 100, 100)}%`,
                            background: `linear-gradient(90deg, #f97316, #ef4444)`,
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted">trust: {emp.trustScore}</span>
                        <ArrowRight size={14} style={{ color: 'var(--text-dim)' }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Normal Employees Grid */}
          <div className="flex items-center gap-8 mb-16">
            <Eye size={16} style={{ color: 'var(--cyan-500)' }} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>Stable Twins</span>
            <span className="text-xs text-muted">— Behavior within expected range</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {normalEmployees.slice(0, 12).map((emp) => {
              const color = getTrustColor(emp.trustScore);
              const initials = emp.name.split(' ').map(n => n[0]).join('');
              return (
                <Link href={`/employee/${emp.id}`} key={emp.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="card" style={{ padding: 14 }}>
                    <div className="flex items-center gap-10">
                      <div className="avatar avatar-sm" style={{ background: emp.avatarColor }}>{initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="text-sm font-semibold truncate">{emp.name}</div>
                        <div className="text-xs text-muted">{emp.department}</div>
                      </div>
                      <div className="text-mono text-sm font-bold" style={{ color }}>{emp.trustScore}</div>
                    </div>
                    <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: 'rgba(148,163,184,0.06)' }}>
                      <div style={{
                        height: '100%', borderRadius: 2, width: `${Math.min(emp.twinDrift * 100, 100)}%`,
                        background: emp.twinDrift < 0.1 ? '#22c55e' : '#eab308',
                      }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
