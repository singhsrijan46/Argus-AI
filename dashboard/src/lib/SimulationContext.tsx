'use client';

/**
 * Argus AI — WebSocket Live Data Provider
 *
 * Single WebSocket connection streams ALL data from the backend.
 * Zero REST polling. Every page reads from shared context.
 *
 * Data included in each WS snapshot:
 *  - simulation status (day, speed, paused)
 *  - server_time
 *  - overview (threats, distribution, model metrics)
 *  - employees (full list with scores)
 *  - alerts (top 15 with explanations)
 *  - activity (latest 30 events)
 *  - analytics (dept stats, model info)
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ApiEmployee, ApiAlert, ApiAnalytics, ApiActivityEvent } from './api';

// ─── Types ───

interface TrustDistribution {
  critical: number;
  high_risk: number;
  medium: number;
  low_risk: number;
  trusted: number;
}

interface WsOverview {
  total_employees: number;
  active_threats: number;
  critical: number;
  high_risk: number;
  trust_distribution: TrustDistribution;
  model_f1: number;
  model_fpr: number;
  model_auc: number;
  model_name: string;
  feature_count: number;
  enhanced_mode: boolean;
}

interface WsAnalytics {
  model_metrics: {
    best_model: string;
    results: Record<string, Record<string, number>>;
    feature_count: number;
    enhanced_mode: boolean;
  };
  top_features: Array<{ feature: string; importance: number }>;
  department_stats: Array<{
    department: string;
    avg_trust: number;
    min_trust: number;
    max_trust: number;
    count: number;
    avg_risk: number;
  }>;
  total_employees: number;
  total_insiders: number;
  total_alerts: number;
}

export interface SimContextValue {
  // Connection
  connected: boolean;

  // Time
  serverTime: string;

  // Simulation state
  day: number;
  maxDay: number;
  speed: number;
  paused: boolean;

  // Data
  employees: ApiEmployee[];
  alerts: ApiAlert[];
  activity: ApiActivityEvent[];
  overview: WsOverview | null;
  analytics: WsAnalytics | null;

  // Actions
  setSpeed: (speed: number) => void;
  togglePause: () => void;
  reset: () => void;
  jumpTo: (day: number) => void;
  tick: () => void;
}

const defaultCtx: SimContextValue = {
  connected: false,
  serverTime: new Date().toISOString(),
  day: 0,
  maxDay: 89,
  speed: 1,
  paused: false,
  employees: [],
  alerts: [],
  activity: [],
  overview: null,
  analytics: null,
  setSpeed: () => {},
  togglePause: () => {},
  reset: () => {},
  jumpTo: () => {},
  tick: () => {},
};

const SimContext = createContext<SimContextValue>(defaultCtx);

const WS_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
  .replace(/^http/, 'ws') + '/ws/live';

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [serverTime, setServerTime] = useState(new Date().toISOString());
  const [day, setDay] = useState(30);
  const [maxDay, setMaxDay] = useState(89);
  const [speed, setSpeedState] = useState(1);
  const [paused, setPaused] = useState(false);
  const [employees, setEmployees] = useState<ApiEmployee[]>([]);
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);
  const [activity, setActivity] = useState<ApiActivityEvent[]>([]);
  const [overview, setOverview] = useState<WsOverview | null>(null);
  const [analytics, setAnalytics] = useState<WsAnalytics | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log('[Argus WS] Connected to', WS_URL);
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.server_time) setServerTime(data.server_time);
          if (data.simulation) {
            setDay(data.simulation.current_day);
            setMaxDay(data.simulation.max_day);
            setSpeedState(data.simulation.speed);
            setPaused(data.simulation.paused);
          }
          if (data.overview) setOverview(data.overview);
          if (data.employees) setEmployees(data.employees);
          if (data.alerts) setAlerts(data.alerts);
          if (data.activity) setActivity(data.activity);
          if (data.analytics) setAnalytics(data.analytics);
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        setConnected(false);
        console.log('[Argus WS] Disconnected, reconnecting in 2s...');
        reconnectTimer.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 2000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Local ticker for Simulation Time when offline / in Demo mode
  useEffect(() => {
    if (connected) return;

    const interval = setInterval(() => {
      setServerTime(prev => {
        if (!prev) return new Date().toISOString();
        try {
          const d = new Date(prev);
          if (!paused) {
            // Advance simulation time by speed seconds
            d.setSeconds(d.getSeconds() + speed);
          }
          return d.toISOString();
        } catch {
          return new Date().toISOString();
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [connected, paused, speed]);

  // Local ticker for Simulation Day when offline / in Demo mode
  useEffect(() => {
    if (connected || paused) return;

    // 1 day = 10000ms / speed (e.g. at 10x speed, 1 day = 1s)
    const dayIntervalMs = Math.max(800, 10000 / speed);
    const dayInterval = setInterval(() => {
      setDay(prev => {
        if (prev >= maxDay) return 5; // wrap around
        return prev + 1;
      });
    }, dayIntervalMs);

    return () => clearInterval(dayInterval);
  }, [connected, paused, speed, maxDay]);

  // ─── Actions sent over WebSocket or run locally ───
  const send = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const setSpeed = useCallback((s: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send({ action: 'set_speed', speed: s });
    } else {
      setSpeedState(s);
    }
  }, [send]);

  const togglePause = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send({ action: 'pause' });
    } else {
      setPaused(prev => !prev);
    }
  }, [send]);

  const reset = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send({ action: 'reset' });
    } else {
      setDay(30);
      setServerTime(new Date(2024, 0, 5 + 30).toISOString());
    }
  }, [send]);

  const jumpTo = useCallback((d: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send({ action: 'jump', day: d });
    } else {
      setDay(d);
      setServerTime(new Date(2024, 0, 5 + d).toISOString());
    }
  }, [send]);

  const tick = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send({ action: 'tick' });
    } else {
      setDay(prev => Math.min(maxDay, prev + 1));
    }
  }, [send, maxDay]);

  const value: SimContextValue = {
    connected, serverTime,
    day, maxDay, speed, paused,
    employees, alerts, activity, overview, analytics,
    setSpeed, togglePause, reset, jumpTo, tick,
  };

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

export function useSimContext() {
  return useContext(SimContext);
}
