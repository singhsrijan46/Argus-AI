'use client';

/**
 * Argus AI — Live Data Hooks
 * React hooks that fetch from FastAPI backend with mock fallback.
 */

import { useState, useEffect } from 'react';
import type { OverviewData, ApiEmployee, ApiAlert, ApiEmployeeDetail, ApiAnalytics, ShapExplanation } from './api';

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

export function useApiStatus() {
  const [live, setLive] = useState(false);
  const [version, setVersion] = useState('');
  const [features, setFeatures] = useState(0);
  useEffect(() => {
    safeFetch<{ status: string; version: string; features: number }>('/api/health').then(d => {
      if (d?.status === 'healthy') {
        setLive(true);
        setVersion(d.version || '');
        setFeatures(d.features || 0);
      }
    });
  }, []);
  return { live, version, features };
}

export function useOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    safeFetch<OverviewData>('/api/overview').then(d => { setData(d); setLoading(false); });
  }, []);
  return { data, loading };
}

export function useEmployees(sortBy = 'trust_score', order = 'asc') {
  const [data, setData] = useState<ApiEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    safeFetch<ApiEmployee[]>(`/api/employees?sort_by=${sortBy}&order=${order}`).then(d => {
      if (d && d.length > 0) setData(d);
      setLoading(false);
    });
  }, [sortBy, order]);
  return { data, loading };
}

export function useAlerts(limit = 20) {
  const [data, setData] = useState<ApiAlert[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    safeFetch<ApiAlert[]>(`/api/alerts?limit=${limit}`).then(d => {
      if (d) setData(d);
      setLoading(false);
    });
  }, [limit]);
  return { data, loading };
}

export function useEmployee(empId: string) {
  const [data, setData] = useState<ApiEmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    safeFetch<ApiEmployeeDetail>(`/api/employee/${empId}`).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [empId]);
  return { data, loading };
}

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

export function useAnalytics() {
  const [data, setData] = useState<ApiAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    safeFetch<ApiAnalytics>('/api/analytics').then(d => {
      setData(d);
      setLoading(false);
    });
  }, []);
  return { data, loading };
}
