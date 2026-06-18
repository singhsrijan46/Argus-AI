'use client';

import { useState, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import MockBanner from '@/components/MockBanner';
import SimulationControl from '@/components/SimulationControl';
import {
  alerts as mockAlerts, getTrustColor,
  type Alert,
} from '@/lib/mockData';
import { useAlerts, useSimulation } from '@/lib/hooks';
import { ChevronDown, ChevronUp, Shield } from 'lucide-react';

function IntentChainViz({ chain }: { chain: Alert['intentChain'] }) {
  if (!chain) return null;

  const allSteps: Record<string, string[]> = {
    'Data Exfiltration': ['login_after_hours', 'access_sensitive_data', 'bulk_download', 'usb_connect', 'file_copy_to_usb'],
    'Privilege Escalation Abuse': ['login_from_new_device', 'privilege_escalation', 'audit_log_access', 'admin_account_creation'],
    'Pre-Resignation Theft': ['job_search_browsing', 'increased_file_access', 'cross_role_data_access', 'bulk_email_to_personal'],
    'Credential Compromise': ['login_from_unusual_location', 'rapid_system_switching', 'access_pattern_mismatch', 'data_access_outside_role'],
  };

  const matchedStrs = (chain.matchedSteps || []).map((s: unknown) => String(s));
  const steps: string[] = allSteps[chain.pattern] || matchedStrs;

  return (
    <div className="alerts-intent">
      <div className="alerts-detail-title">
        Intent signal chain
        <span>{chain.pattern}</span>
      </div>
      <div className="alerts-chain">
        {steps.map((step, i) => {
          const stepStr = String(step);
          const isMatched = matchedStrs.includes(stepStr);
          return (
            <div key={stepStr + i} className={`alerts-chain-step ${isMatched ? 'alerts-chain-step--matched' : ''}`}>
              <span className="alerts-chain-index">{String(i + 1).padStart(2, '0')}</span>
              <span>
                {stepStr.replace(/_/g, ' ')}
              </span>
            </div>
          );
        })}
      </div>
      <div className="alerts-confidence">
        <span>Confidence {(chain.confidence * 100).toFixed(0)}%</span>
        <span>{matchedStrs.length}/{steps.length} matched</span>
      </div>
    </div>
  );
}

function getActionText(alert: Alert) {
  if (alert.trustScore < 20) {
    return 'Suspend the active session, notify the CISO, preserve audit logs, and begin forensic review.';
  }
  if (alert.trustScore < 40) {
    return 'Require step-up authentication, assign SOC review within 15 minutes, and monitor subsequent actions.';
  }
  return 'Add to watchlist, increase monitoring frequency, and schedule a behavioral review with the line manager.';
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
          icon: '',
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
    <AppShell
      title="Alerts"
      subtitle="Prioritized threats with intent chain analysis"
      headerExtra={
        <>
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
        </>
      }
    >
      <MockBanner show={isMock} />

          {filtered.length === 0 ? (
            <div className="alerts-empty">
              <Shield size={30} />
              <div>
                No alerts at Day {sim.day}
              </div>
              <p>
                All employee behavior is within baseline norms. Alerts will appear as insider threat scenarios ramp up.
              </p>
            </div>
          ) : (
            <div className="alerts-page-list">
              {filtered.map((alert) => {
                const isExpanded = expandedId === alert.id;
                const color = getTrustColor(alert.trustScore);
                return (
                  <article
                    key={alert.id}
                    className={`alerts-card alerts-card--${alert.severity.toLowerCase()}`}
                    onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                  >
                    {/* Alert Header */}
                    <div className="alerts-card-header">
                      <div className="alerts-card-main">
                        <div className="alerts-card-title-row">
                          <span className={`alerts-severity alerts-severity--${alert.severity.toLowerCase()}`}>{alert.severity}</span>
                          <h2>{alert.employeeName}</h2>
                          <span className="alerts-employee-id">{alert.employeeId}</span>
                          <span className="alerts-status">
                            {alert.status}
                          </span>
                        </div>
                        <div className="alerts-card-meta">
                          <span>Day {sim.day}</span>
                          <span>{alert.department}</span>
                          {alert.intentChain && (
                            <span>{alert.intentChain.pattern}</span>
                          )}
                        </div>
                      </div>

                      <div className="alerts-trust">
                        <strong style={{ color }}>{alert.trustScore}</strong>
                        <span>trust</span>
                      </div>

                      <button className="alerts-expand" aria-label={isExpanded ? 'Collapse alert' : 'Expand alert'}>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="alerts-detail">
                        <div className="alerts-detail-grid">
                          <div>
                            <div className="alerts-detail-title">Risk factors</div>
                            <div className="alerts-risk-list">
                              {alert.riskFactors.map((rf, i) => (
                                <div key={i} className="alerts-risk-row">
                                  <div className="alerts-risk-index">{String(i + 1).padStart(2, '0')}</div>
                                  <div className="alerts-risk-copy">
                                    <strong>{rf.factor}</strong>
                                    <span>{rf.detail}</span>
                                  </div>
                                  <span className="alerts-impact">
                                    {rf.impact}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <IntentChainViz chain={alert.intentChain} />
                            <div className="alerts-action">
                              <div className="alerts-detail-title">Recommended action</div>
                              <p>{getActionText(alert)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
    </AppShell>
  );
}
