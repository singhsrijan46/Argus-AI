'use client';

import { useState, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import MockBanner from '@/components/MockBanner';
import SimulationControl from '@/components/SimulationControl';
import {
  alerts as mockAlerts, getTrustColor,
  type Alert,
} from '@/lib/mockData';
import { useAlerts, useSimulation } from '@/lib/hooks';
import { ShieldAlert, ChevronDown, ChevronUp, Clock, Target, Shield } from 'lucide-react';

function IntentChainViz({ chain }: { chain: Alert['intentChain'] }) {
  if (!chain) return null;

  const allSteps: Record<string, string[]> = {
    'Data Exfiltration': ['login_after_hours', 'access_sensitive_data', 'bulk_download', 'usb_connect', 'file_copy_to_usb'],
    'Privilege Escalation Abuse': ['login_from_new_device', 'privilege_escalation', 'audit_log_access', 'admin_account_creation'],
    'Pre-Resignation Theft': ['job_search_browsing', 'increased_file_access', 'cross_role_data_access', 'bulk_email_to_personal'],
    'Credential Compromise': ['login_from_unusual_location', 'rapid_system_switching', 'access_pattern_mismatch', 'data_access_outside_role'],
  };

  const steps = allSteps[chain.pattern] || chain.matchedSteps;

  return (
    <div style={{ marginTop: 12 }}>
      <div className="text-xs text-muted mb-8" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Intent Signal Chain — {chain.pattern}
      </div>
      <div className="intent-chain">
        {steps.map((step, i) => {
          const isMatched = chain.matchedSteps.includes(step);
          return (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className={`intent-step ${isMatched ? 'matched' : ''}`}>
                {isMatched && '✓ '}
                {step.replace(/_/g, ' ')}
              </div>
              {i < steps.length - 1 && <span className="intent-arrow">→</span>}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-8 mt-8">
        <Target size={13} style={{ color: 'var(--cyan-500)' }} />
        <span className="text-xs text-mono" style={{ color: 'var(--cyan-400)' }}>
          Confidence: {(chain.confidence * 100).toFixed(0)}% • {chain.matchedSteps.length}/{steps.length} steps matched
        </span>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const sim = useSimulation();
  const { data: liveAlerts, isMock } = useAlerts(30);

  // Map live alerts to Alert type
  const alerts: Alert[] = useMemo(() => {
    if (liveAlerts.length > 0) {
      return liveAlerts.map((a, i) => ({
        id: `ALT_${i}`,
        employeeId: a.emp_id,
        employeeName: a.name,
        department: a.department,
        trustScore: Math.round(a.trust_score),
        previousTrustScore: Math.round(a.trust_score + 20),
        trustLevel: (a.trust_score < 20 ? 'CRITICAL' : a.trust_score < 40 ? 'HIGH_RISK' : a.trust_score < 60 ? 'MEDIUM_RISK' : 'LOW_RISK') as Alert['trustLevel'],
        timestamp: new Date().toISOString(),
        severity: a.severity as Alert['severity'],
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
      }));
    }
    return mockAlerts;
  }, [liveAlerts]);

  const [expandedId, setExpandedId] = useState<string | null>(alerts[0]?.id || null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = statusFilter === 'all'
    ? alerts
    : alerts.filter(a => a.status === statusFilter);

  return (
    <div className="app-layout">
      <Sidebar day={sim.day} maxDay={sim.maxDay} live={sim.live} />
      <main className="main-content">
        <div className="page-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-title">Alert Queue</h1>
              <p className="page-subtitle">Prioritized insider threat alerts with intent chain analysis</p>
            </div>
            <div className="flex items-center gap-16">
              <SimulationControl
                day={sim.day} maxDay={sim.maxDay} speed={sim.speed}
                paused={sim.paused} live={sim.live}
                onSetSpeed={sim.setSpeed} onTogglePause={sim.togglePause}
                onReset={sim.reset} onJumpTo={sim.jumpTo}
              />
              <div className="filter-tabs">
                {['all', 'active', 'investigating', 'resolved'].map(s => (
                  <button key={s} className={`filter-tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="page-content">
          <MockBanner show={isMock} />

          {filtered.length === 0 ? (
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Shield size={36} style={{ color: '#22c55e', opacity: 0.3, margin: '0 auto 16px' }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
                No alerts at Day {sim.day}
              </div>
              <div className="text-sm text-muted">
                All employee behavior is within baseline norms. Alerts will appear as insider threat scenarios ramp up.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-16">
              {filtered.map((alert) => {
                const isExpanded = expandedId === alert.id;
                const color = getTrustColor(alert.trustScore);
                return (
                  <div
                    key={alert.id}
                    className={`card ${alert.severity === 'CRITICAL' ? 'card-glow-red' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                  >
                    {/* Alert Header */}
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 'var(--radius-md)',
                        background: alert.severity === 'CRITICAL' ? 'rgba(239,68,68,0.12)' : alert.severity === 'HIGH' ? 'rgba(249,115,22,0.12)' : 'rgba(234,179,8,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `1px solid ${alert.severity === 'CRITICAL' ? 'rgba(239,68,68,0.2)' : alert.severity === 'HIGH' ? 'rgba(249,115,22,0.2)' : 'rgba(234,179,8,0.2)'}`,
                      }}>
                        <ShieldAlert size={20} style={{ color: alert.severity === 'CRITICAL' ? '#ef4444' : alert.severity === 'HIGH' ? '#f97316' : '#eab308' }} />
                      </div>

                      <div style={{ flex: 1 }}>
                        <div className="flex items-center gap-8">
                          <span className={`alert-severity-badge ${alert.severity}`}>{alert.severity}</span>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>{alert.employeeName}</span>
                          <span className="text-xs text-muted">({alert.employeeId})</span>
                          <span style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                            background: 'rgba(148,163,184,0.08)', color: 'var(--text-muted)',
                            textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em',
                          }}>
                            {alert.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted mt-4 flex items-center gap-8">
                          <Clock size={12} />
                          Day {sim.day}
                          <span>•</span>
                          {alert.department}
                          {alert.intentChain && (
                            <>
                              <span>•</span>
                              <span style={{ color: 'var(--cyan-400)', fontFamily: 'var(--font-mono)' }}>
                                ⛓ {alert.intentChain.pattern}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: 70 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{alert.trustScore}</div>
                        <div className="text-xs text-muted mt-4">trust</div>
                      </div>

                      {isExpanded ? <ChevronUp size={18} style={{ color: 'var(--text-dim)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-dim)' }} />}
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '20px', background: 'rgba(0,0,0,0.15)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                          <div>
                            <div className="text-xs text-muted mb-8" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              Risk Factors
                            </div>
                            <div className="flex flex-col gap-8">
                              {alert.riskFactors.map((rf, i) => (
                                <div key={i} style={{
                                  display: 'flex', alignItems: 'flex-start', gap: 10,
                                  padding: '10px 12px', borderRadius: 'var(--radius-md)',
                                  background: 'rgba(15,23,42,0.4)', border: '1px solid var(--border-subtle)',
                                }}>
                                  <span style={{ fontSize: 16, flexShrink: 0 }}>{rf.icon}</span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{rf.factor}</div>
                                    <div className="text-xs text-muted mt-4">{rf.detail}</div>
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#ef4444' }}>
                                    {rf.impact}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <IntentChainViz chain={alert.intentChain} />
                            <div style={{
                              marginTop: 20, padding: 16, borderRadius: 'var(--radius-md)',
                              background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.12)',
                            }}>
                              <div className="text-xs mb-8" style={{ fontWeight: 600, color: 'var(--cyan-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Recommended Action
                              </div>
                              <div className="text-sm">
                                {alert.trustScore < 20
                                  ? '🚨 Suspend session immediately. Notify CISO. Initiate forensic investigation. Preserve audit logs.'
                                  : alert.trustScore < 40
                                  ? '⚠️ Require step-up authentication. Flag for SOC review within 15 minutes. Monitor all subsequent actions.'
                                  : '🔍 Add to watchlist. Increase monitoring frequency. Schedule behavioral review with line manager.'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
