'use client';

import { useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Zap, Calendar, ChevronRight } from 'lucide-react';

interface SimulationControlProps {
  day: number;
  maxDay: number;
  speed: number;
  paused: boolean;
  live: boolean;
  onSetSpeed: (speed: number) => void;
  onTogglePause: () => void;
  onReset: () => void;
  onJumpTo: (day: number) => void;
}

const SPEED_OPTIONS = [1, 2, 5, 10, 30];

export default function SimulationControl({
  day, maxDay, speed, paused, live,
  onSetSpeed, onTogglePause, onReset, onJumpTo,
}: SimulationControlProps) {
  const [showScrubber, setShowScrubber] = useState(false);

  const progress = maxDay > 0 ? ((day - 5) / (maxDay - 5)) * 100 : 0;

  const getPhaseLabel = (d: number) => {
    if (d <= 30) return { label: 'Baseline', color: '#22c55e' };
    if (d <= 60) return { label: 'Ramp-up', color: '#f59e0b' };
    return { label: 'Attack', color: '#ef4444' };
  };

  const phase = getPhaseLabel(day);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    const targetDay = Math.round(5 + pct * (maxDay - 5));
    onJumpTo(targetDay);
  }, [maxDay, onJumpTo]);

  if (!live) return null;

  return (
    <div className="sim-control">
      {/* Day Counter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Calendar size={12} style={{ color: 'var(--accent-text)' }} />
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
          Day <span style={{ color: 'var(--text)', fontWeight: 700 }}>{day}</span>
          <span style={{ color: 'var(--text-muted)' }}>/{maxDay}</span>
        </span>
      </div>

      {/* Phase Badge */}
      <span style={{
        padding: '2px 6px', borderRadius: 'var(--radius-sm)',
        background: `${phase.color}15`, color: phase.color,
        fontWeight: 700, fontSize: 9, letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        {phase.label}
      </span>

      {/* Divider */}
      <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

      {/* Progress Bar (clickable scrubber) */}
      <div
        onClick={handleProgressClick}
        onMouseEnter={() => setShowScrubber(true)}
        onMouseLeave={() => setShowScrubber(false)}
        style={{
          width: 100, height: 6, borderRadius: 3,
          background: 'rgba(30, 41, 59, 0.8)',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
        }}
        title={`Click to jump to a specific day`}
      >
        {/* Baseline zone */}
        <div style={{
          position: 'absolute', left: 0,
          width: `${((30 - 5) / (maxDay - 5)) * 100}%`,
          height: '100%', background: 'rgba(34, 197, 94, 0.15)',
        }} />
        {/* Ramp-up zone */}
        <div style={{
          position: 'absolute', left: `${((30 - 5) / (maxDay - 5)) * 100}%`,
          width: `${((60 - 30) / (maxDay - 5)) * 100}%`,
          height: '100%', background: 'rgba(245, 158, 11, 0.15)',
        }} />
        {/* Attack zone */}
        <div style={{
          position: 'absolute', left: `${((60 - 5) / (maxDay - 5)) * 100}%`,
          width: `${((maxDay - 60) / (maxDay - 5)) * 100}%`,
          height: '100%', background: 'rgba(239, 68, 68, 0.15)',
        }} />
        {/* Progress fill */}
        <div style={{
          width: `${progress}%`, height: '100%',
          borderRadius: 3,
          background: `linear-gradient(90deg, #22c55e 0%, #f59e0b 50%, #ef4444 100%)`,
          transition: 'width 0.5s ease',
          position: 'relative',
          zIndex: 1,
        }} />
        {showScrubber && (
          <div style={{
            position: 'absolute', left: `${progress}%`, top: -3,
            width: 12, height: 12, borderRadius: '50%',
            background: '#e2e8f0', border: '2px solid #8b5cf6',
            transform: 'translateX(-50%)', zIndex: 2,
            boxShadow: '0 0 6px rgba(139,92,246,0.6)',
          }} />
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

      {/* Play/Pause */}
      <button
        onClick={onTogglePause}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, borderRadius: 'var(--radius-sm)',
          background: paused ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
          border: `1px solid ${paused ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          color: paused ? '#22c55e' : '#f59e0b',
          cursor: 'pointer', padding: 0,
        }}
        title={paused ? 'Resume simulation' : 'Pause simulation'}
      >
        {paused ? <Play size={11} /> : <Pause size={11} />}
      </button>

      {/* Speed Control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Zap size={11} style={{ color: '#06b6d4' }} />
        {SPEED_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => onSetSpeed(s)}
            style={{
              padding: '2px 5px', borderRadius: 'var(--radius-sm)',
              border: s === speed
                ? '1px solid rgba(6, 182, 212, 0.5)'
                : '1px solid transparent',
              background: s === speed ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              color: s === speed ? '#22d3ee' : '#64748b',
              fontSize: 10, fontWeight: s === speed ? 700 : 500,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s',
            }}
          >
            {s}×
          </button>
        ))}
      </div>

      {/* Reset */}
      <button
        onClick={onReset}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, borderRadius: 'var(--radius-sm)',
          background: 'rgba(100, 116, 139, 0.1)',
          border: '1px solid rgba(100, 116, 139, 0.2)',
          color: '#64748b', cursor: 'pointer', padding: 0,
        }}
        title="Reset to Day 30"
      >
        <RotateCcw size={11} />
      </button>

      {/* Live indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: paused ? '#f59e0b' : '#22c55e',
          boxShadow: paused ? '0 0 6px rgba(245,158,11,0.5)' : '0 0 6px rgba(34,197,94,0.5)',
          animation: paused ? 'none' : 'pulse 2s infinite',
        }} />
        <span style={{
          color: paused ? '#f59e0b' : '#22c55e',
          fontWeight: 600, fontSize: 9, letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {paused ? 'PAUSED' : 'LIVE'}
        </span>
      </div>
    </div>
  );
}
