'use client';

import { useState, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import MockBanner from '@/components/MockBanner';
import SimulationControl from '@/components/SimulationControl';
import Panel from '@/components/Panel';
import { activityFeed as mockActivityFeed, type ActivityEvent } from '@/lib/mockData';
import { useActivity, useSimulation } from '@/lib/hooks';
import { Activity } from 'lucide-react';

export default function ActivityPage() {
  const sim = useSimulation();
  const { data: liveActivity, isMock } = useActivity(undefined, 100);
  const [filter, setFilter] = useState<string>('all');

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
    <AppShell
      title="Live feed"
      subtitle="Real-time behavioral events"
      headerExtra={
        <>
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
        </>
      }
    >
      <MockBanner show={isMock} />

      <div className="flex items-center gap-8 mb-16">
        <span className={`pill ${isMock ? '' : 'pill--live'}`}>
          {!isMock && <span className="pill-dot" />}
          {isMock ? 'Demo' : `Day ${sim.day}`} · {filtered.length} events
        </span>
      </div>

      <Panel title="Event stream" icon={Activity} noPadding>
        <div className="feed-container">
          {filtered.map((event) => {
            const riskLevel = event.riskContribution > 70 ? 'high' : event.riskContribution > 30 ? 'medium' : 'low';
            return (
              <div key={event.id} className="feed-item">
                <span className="feed-time">{event.timestamp}</span>
                <span style={{ fontSize: 16 }}>{event.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="feed-employee">{event.employeeName}</span>
                  <span className="text-xs text-mono text-muted" style={{ marginLeft: 6 }}>({event.employeeId})</span>
                  <br />
                  <span className="feed-detail">{event.detail}</span>
                  <span className="text-xs text-muted" style={{ marginLeft: 8 }}>on {event.system}</span>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span className={`feed-risk ${riskLevel}`}>{event.riskContribution}</span>
                  <div className="text-xs text-muted mt-8">{event.actionType.replace(/_/g, ' ')}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </AppShell>
  );
}
