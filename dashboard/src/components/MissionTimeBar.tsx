'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Zap, AlertTriangle } from 'lucide-react';

const SPEED_OPTIONS = [1, 2, 5, 10, 30];

interface MissionTimeBarProps {
  serverTime: string;
  day: number;
  maxDay: number;
  speed: number;
  paused: boolean;
  live: boolean;
  criticalCount?: number;
  isDemo?: boolean;
  onSetSpeed: (speed: number) => void;
  onTogglePause: () => void;
  onReset: () => void;
  onJumpTo: (day: number) => void;
}

function formatClock(raw: string): { time: string; tz: string } {
  if (!raw || raw === '--:--:--') return { time: '--:--:--', tz: 'IST' };
  if (raw.includes('T')) {
    try {
      const d = new Date(raw);
      return {
        time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        tz: 'IST',
      };
    } catch {
      return { time: raw.slice(11, 19) || raw, tz: 'IST' };
    }
  }
  return { time: raw, tz: 'IST' };
}

function getPhase(day: number) {
  if (day <= 30) return { label: 'Baseline', tone: 'baseline' as const };
  if (day <= 60) return { label: 'Ramp-up', tone: 'rampup' as const };
  return { label: 'Attack', tone: 'attack' as const };
}

function simulationDate(day: number) {
  const d = new Date(2024, 0, 5);
  d.setDate(d.getDate() + day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MissionTimeBar({
  serverTime,
  day,
  maxDay,
  speed,
  paused,
  live,
  criticalCount = 0,
  isDemo = false,
  onSetSpeed,
  onTogglePause,
  onReset,
  onJumpTo,
}: MissionTimeBarProps) {
  const [scrubHover, setScrubHover] = useState(false);
  const { time, tz } = formatClock(serverTime);
  const phase = getPhase(day);
  const progress = maxDay > 5 ? ((day - 5) / (maxDay - 5)) * 100 : 0;
  const simDate = useMemo(() => simulationDate(day), [day]);

  const handleScrubClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onJumpTo(Math.round(5 + pct * (maxDay - 5)));
  }, [maxDay, onJumpTo]);

  const baselinePct = maxDay > 5 ? ((30 - 5) / (maxDay - 5)) * 100 : 33;
  const rampPct = maxDay > 5 ? ((60 - 30) / (maxDay - 5)) * 100 : 33;

  return (
    <motion.div
      className="mission-time-bar"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="mission-time-top">
        <div className="mission-time-day">
          <span className="mission-time-label">Simulation timeline</span>
          <div className="mission-time-day-row">
            <span className="mission-time-day-value">
              Day {day}<span className="mission-time-day-max"> / {maxDay}</span>
            </span>
            <span className={`mission-phase mission-phase--${phase.tone}`}>{phase.label} phase</span>
          </div>
          <span className="mission-time-meta">{simDate} · Simulation Clock: {time} {tz}</span>
        </div>

        <div className="mission-time-status">
          {isDemo ? (
            <span className="mission-status-chip mission-status-chip--demo">Demo mode</span>
          ) : (
            <span className={`mission-status-chip ${paused ? 'mission-status-chip--paused' : 'mission-status-chip--live'}`}>
              <span className="mission-status-dot" />
              {paused ? 'Paused' : 'Live'}
            </span>
          )}
          {criticalCount > 0 && (
            <span className="mission-status-chip mission-status-chip--critical">
              <AlertTriangle size={13} />
              {criticalCount} critical
            </span>
          )}
        </div>
      </div>

      <>
          <div
            className="mission-scrubber"
            onClick={handleScrubClick}
            onMouseEnter={() => setScrubHover(true)}
            onMouseLeave={() => setScrubHover(false)}
            role="slider"
            aria-valuenow={day}
            aria-valuemin={5}
            aria-valuemax={maxDay}
            tabIndex={0}
            title="Click to jump to a simulation day"
          >
            <div className="mission-scrubber-zones">
              <div className="mission-scrubber-zone mission-scrubber-zone--baseline" style={{ width: `${baselinePct}%` }} />
              <div className="mission-scrubber-zone mission-scrubber-zone--rampup" style={{ width: `${rampPct}%` }} />
              <div className="mission-scrubber-zone mission-scrubber-zone--attack" style={{ flex: 1 }} />
            </div>
            <div className="mission-scrubber-fill" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
            {scrubHover && (
              <div className="mission-scrubber-thumb" style={{ left: `${progress}%` }} />
            )}
          </div>
          <div className="mission-scrubber-legend">
            <span>Baseline</span>
            <span>Ramp-up</span>
            <span>Attack</span>
          </div>

          <div className="mission-time-controls">
            <button
              type="button"
              className={`mission-ctrl-btn ${paused ? 'mission-ctrl-btn--play' : 'mission-ctrl-btn--pause'}`}
              onClick={onTogglePause}
              title={paused ? 'Resume' : 'Pause'}
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
              {paused ? 'Resume' : 'Pause'}
            </button>

            <div className="mission-speed-group">
              <Zap size={13} className="mission-speed-icon" />
              {SPEED_OPTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`mission-speed-btn ${s === speed ? 'active' : ''}`}
                  onClick={() => onSetSpeed(s)}
                >
                  {s}×
                </button>
              ))}
            </div>

            <button type="button" className="mission-ctrl-btn mission-ctrl-btn--ghost" onClick={onReset} title="Reset to Day 30">
              <RotateCcw size={14} />
              Reset
            </button>
          </div>
        </>
    </motion.div>
  );
}
