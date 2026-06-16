'use client';

/**
 * Argus AI — Live Data Hooks
 *
 * ALL data comes through WebSocket via SimulationContext.
 * Zero REST polling. Every hook reads from shared WS state.
 *
 * Only exception: SHAP explanations (on-demand, per-employee) use REST.
 */

import { useState, useEffect, useMemo } from 'react';
import { useSimContext } from './SimulationContext';
import type { ApiEmployee, ApiEmployeeDetail, ShapExplanation } from './api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function safeFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  ALL HOOKS — WebSocket-powered (zero polling)
// ═══════════════════════════════════════════════════════════════

/** Simulation status + controls */
export function useSimulation() {
  const ctx = useSimContext();
  return {
    live: ctx.connected,
    day: ctx.day,
    maxDay: ctx.maxDay,
    speed: ctx.speed,
    paused: ctx.paused,
    serverTime: ctx.serverTime,
    setSpeed: ctx.setSpeed,
    togglePause: ctx.togglePause,
    reset: ctx.reset,
    jumpTo: ctx.jumpTo,
    tick: ctx.tick,
  };
}

/** Employee list */
export function useEmployees(sortBy = 'trust_score', order = 'asc') {
  const ctx = useSimContext();

  const data = useMemo(() => {
    if (!ctx.employees.length) return [];
    const sorted = [...ctx.employees];
    sorted.sort((a, b) => {
      const aVal = (a as any)[sortBy] ?? 0;
      const bVal = (b as any)[sortBy] ?? 0;
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [ctx.employees, sortBy, order]);

  return { data, loading: false, isMock: !ctx.connected };
}

/** Overview stats */
export function useOverview() {
  const ctx = useSimContext();

  const data = useMemo(() => {
    if (!ctx.overview) return null;
    return {
      total_employees: ctx.overview.total_employees,
      active_threats: ctx.overview.active_threats,
      trust_distribution: ctx.overview.trust_distribution || {
        critical: ctx.overview.critical,
        high_risk: ctx.overview.high_risk,
        medium: 0, low_risk: 0, trusted: 0,
      },
      model_f1: ctx.overview.model_f1 ?? 0.9495,
      model_fpr: ctx.overview.model_fpr ?? 0.0012,
      model_auc: ctx.overview.model_auc ?? 0.983,
      model_name: ctx.overview.model_name ?? 'LightGBM',
      feature_count: ctx.overview.feature_count ?? 211,
      enhanced_mode: ctx.overview.enhanced_mode ?? true,
      simulation_day: ctx.day,
    };
  }, [ctx.overview, ctx.day]);

  return { data, loading: false, isMock: !ctx.connected };
}

/** Alerts */
export function useAlerts(limit = 20) {
  const ctx = useSimContext();
  const data = useMemo(() => ctx.alerts.slice(0, limit), [ctx.alerts, limit]);
  return { data, loading: false, isMock: !ctx.connected };
}

/** Activity feed */
export function useActivity(empId?: string, limit = 50) {
  const ctx = useSimContext();
  const data = useMemo(() => {
    let events = ctx.activity;
    if (empId) {
      events = events.filter(e => e.emp_id === empId);
    }
    return events.slice(0, limit);
  }, [ctx.activity, empId, limit]);
  return { data, loading: false, isMock: !ctx.connected };
}

/** Analytics */
export function useAnalytics() {
  const ctx = useSimContext();
  return { data: ctx.analytics, loading: false, isMock: !ctx.connected };
}

/** API Status */
export function useApiStatus() {
  const ctx = useSimContext();
  return { live: ctx.connected, version: '2.1.0', features: 211 };
}

// ═══════════════════════════════════════════════════════════════
//  REST-only hooks (on-demand, not streaming)
// ═══════════════════════════════════════════════════════════════

/** Employee Detail — REST (per-employee twin comparison, timeline) */
export function useEmployee(empId: string) {
  const [data, setData] = useState<ApiEmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);
  const ctx = useSimContext();

  // Re-fetch when the simulation day changes
  useEffect(() => {
    let active = true;
    safeFetch<ApiEmployeeDetail>(`/api/employee/${empId}`).then(d => {
      if (!active) return;
      setData(d);
      setIsMock(!d);
      setLoading(false);
    });
    return () => { active = false; };
  }, [empId, ctx.day]);

  return { data, loading, isMock };
}

/** SHAP Explanation — REST, one-shot */
export function useShapExplanation(empId: string) {
  const [data, setData] = useState<ShapExplanation | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    safeFetch<ShapExplanation>(`/api/explain/${empId}`).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [empId]);
  return { data, loading };
}
