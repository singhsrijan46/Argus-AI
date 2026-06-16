'use client';

import { useState, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import MockBanner from '@/components/MockBanner';
import SimulationControl from '@/components/SimulationControl';
import { activityFeed as mockActivityFeed, type ActivityEvent } from '@/lib/mockData';
import { useActivity, useSimulation } from '@/lib/hooks';
import { Activity } from 'lucide-react';

export default function ActivityPage() {
  const sim = useSimulation();
  const { data: liveActivity, isMock } = useActivity(undefined, 100);
  const [filter, setFilter] = useState<string>('all');

  // Map live API events to UI format
  const events: ActivityEvent[] = useMemo(() => {
    if (liveActivity.length > 0) {
      return liveActivity.map((evt, i) => ({
        id: evt.event_id || `evt_${i}`,
        timestamp: new Date(evt.timestamp).toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }),
        employeeId: evt.emp_id,
        employeeName: evt.emp_id,
        actionType: evt.action_type,
        system: evt.system,
        detail: `${evt.action_type.replace(/_/g, ' ')} — ${evt.resource || evt.system}${evt.records_accessed > 0 ? ` (${evt.records_accessed} records)` : ''}`,
        riskContribution: evt.is_after_hours && evt.is_new_device ? 90
          : evt.is_after_hours ? 65
          : evt.is_new_device ? 55
          : evt.action_type.includes('escalation') ? 95
          : evt.action_type.includes('usb') ? 80
          : evt.records_accessed > 50 ? 45
          : evt.data_volume_mb > 5 ? 40
          : 5,
        icon: evt.action_type.includes('login') ? '🔑'
          : evt.action_type.includes('logout') ? '🔒'
          : evt.action_type.includes('usb') ? '💾'
          : evt.action_type.includes('escalation') ? '💀'
          : evt.action_type.includes('email') ? '📧'
          : evt.is_after_hours ? '🌙'
          : evt.is_new_device ? '🔌'
          : '🔍',
      }));
    }
    return mockActivityFeed;
  }, [liveActivity]);

  const riskLevels = ['all', 'critical', 'high', 'medium', 'low'];
  const filtered = filter === 'all'
    ? events
    : events.filter(e => {
        if (filter === 'critical') return e.riskContribution > 85;
        if (filter === 'high') return e.riskContribution > 60 && e.riskContribution <= 85;
        if (filter === 'medium') return e.riskContribution > 20 && e.riskContribution <= 60;
        return e.riskContribution <= 20;
      });

  return (
    <div className="app-layout">
      <Sidebar day={sim.day} maxDay={sim.maxDay} live={sim.live} />
      <main className="main-content">
        <div className="page-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-title">Live Activity Feed</h1>
              <p className="page-subtitle">Real-time behavioral event stream across all departments</p>
            </div>
            <div className="flex items-center gap-12">
              <SimulationControl
                day={sim.day} maxDay={sim.maxDay} speed={sim.speed}
                paused={sim.paused} live={sim.live}
                onSetSpeed={sim.setSpeed} onTogglePause={sim.togglePause}
                onReset={sim.reset} onJumpTo={sim.jumpTo}
              />
              <div className="filter-tabs">
                {riskLevels.map(l => (
                  <button key={l} className={`filter-tab ${filter === l ? 'active' : ''}`} onClick={() => setFilter(l)}>
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="page-content">
          <MockBanner show={isMock} />

          {/* Live indicator */}
          <div className="flex items-center gap-8 mb-16">
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isMock ? '#eab308' : '#22c55e',
              boxShadow: isMock ? '0 0 8px rgba(234,179,8,0.4)' : '0 0 8px rgba(34,197,94,0.4)',
              animation: isMock ? 'none' : 'pulse-dot 2s ease-in-out infinite',
            }} />
            <span className="text-xs text-mono" style={{ color: isMock ? '#eab308' : '#22c55e' }}>
              {isMock ? 'MOCK DATA' : `LIVE — Day ${sim.day}`} — {filtered.length} events
            </span>
          </div>

          <div className="card">
            <div className="card-body" style={{ padding: '8px 20px 20px' }}>
              {filtered.map((event) => {
                const riskLevel = event.riskContribution > 70 ? 'high' : event.riskContribution > 30 ? 'medium' : 'low';
                return (
                  <div
                    key={event.id}
                    className="feed-item"
                  >
                    <span className="feed-time">{event.timestamp}</span>
                    <span className="feed-icon" style={{ fontSize: 16 }}>{event.icon}</span>
                    <div className="feed-content">
                      <span className="feed-employee">{event.employeeName}</span>
                      <span className="text-xs text-mono text-muted" style={{ marginLeft: 6 }}>({event.employeeId})</span>
                      <br />
                      <span className="feed-detail">{event.detail}</span>
                      <span className="text-xs text-muted" style={{ marginLeft: 8 }}>on {event.system}</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span className={`feed-risk ${riskLevel}`}>{event.riskContribution}</span>
                      <div className="text-xs text-muted mt-4">{event.actionType.replace(/_/g, ' ')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
