/**
 * Argus AI — API Client
 * Fetches live data from FastAPI backend (http://localhost:8000).
 * Falls back to mock data if API is unavailable.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function apiFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as T;
  } catch {
    console.warn(`[Argus API] ${path} failed, using fallback`);
    return fallback;
  }
}

async function apiPost<T>(path: string, body: Record<string, unknown>, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as T;
  } catch {
    console.warn(`[Argus API] POST ${path} failed`);
    return fallback;
  }
}

// ─── Types ───

export interface OverviewData {
  total_employees: number;
  active_threats: number;
  trust_distribution: {
    critical: number;
    high_risk: number;
    medium: number;
    low_risk: number;
    trusted: number;
  };
  model_f1: number;
  model_fpr: number;
  model_auc: number;
  model_name: string;
  feature_count: number;
  enhanced_mode: boolean;
  simulation_day?: number;
}

export interface ApiEmployee {
  emp_id: string;
  name: string;
  department: string;
  role: string;
  branch: string;
  clearance_level: number;
  trust_score: number;
  risk_score: number;
  twin_drift?: number;
  is_insider?: boolean;
}

export interface ApiAlert {
  emp_id: string;
  name: string;
  department: string;
  role: string;
  risk_score: number;
  trust_score: number;
  is_insider: boolean;
  severity: string;
  matched_chain: string;
  chain_confidence: number;
  chain_signals: string[];
  top_features: Array<{ feature: string; zscore: number; value: number }>;
  recommended_actions: string[];
  summary: string;
}

export interface ApiEmployeeDetail {
  employee: Record<string, unknown>;
  trust_score: number;
  risk_score: number;
  twin_comparison: {
    dimensions?: Array<{ category: string; baseline: number; current: number }>;
  };
  trust_timeline: Array<{ day_index: number; trust_score: number; risk_score: number }>;
  drift_history: Record<string, unknown>[];
  simulation_day?: number;
}

export interface ApiAnalytics {
  model_metrics: {
    best_model: string;
    results: Record<string, unknown>;
    feature_count: number;
    enhanced_mode: boolean;
  };
  top_features: Array<{ feature: string; importance: number }>;
  meta_learner_weights: Record<string, number>;
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
  simulation_day?: number;
}

export interface ShapExplanation {
  prediction: number;
  base_value: number;
  top_risk_factors: Array<{ feature: string; shap_value: number; feature_value: number }>;
  top_protective_factors: Array<{ feature: string; shap_value: number; feature_value: number }>;
  total_shap_positive: number;
  total_shap_negative: number;
}

export interface HealthData {
  status: string;
  version: string;
  models_loaded: number;
  features: number;
  enhanced_mode: boolean;
  employees: number;
  simulation_day?: number;
}

export interface ApiActivityEvent {
  event_id: string;
  timestamp: string;
  emp_id: string;
  day_index: number;
  action_type: string;
  system: string;
  resource: string | null;
  records_accessed: number;
  data_volume_mb: number;
  device_id: string;
  ip_address: string;
  is_after_hours: boolean;
  is_new_device: boolean;
  is_weekend: boolean;
  geo_location: string;
}

export interface SimulationStatus {
  current_day: number;
  max_day: number;
  speed: number;
  paused: boolean;
  auto_advance: boolean;
}

// ─── API Functions ───

export async function fetchHealth(): Promise<HealthData | null> {
  return apiFetch('/api/health', null);
}

export async function fetchOverview(): Promise<OverviewData | null> {
  return apiFetch('/api/overview', null);
}

export async function fetchEmployees(params?: {
  department?: string;
  sort_by?: string;
  order?: string;
  search?: string;
}): Promise<ApiEmployee[]> {
  const query = new URLSearchParams();
  if (params?.department) query.set('department', params.department);
  if (params?.sort_by) query.set('sort_by', params.sort_by);
  if (params?.order) query.set('order', params.order);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  return apiFetch(`/api/employees${qs ? '?' + qs : ''}`, []);
}

export async function fetchEmployee(empId: string): Promise<ApiEmployeeDetail | null> {
  return apiFetch(`/api/employee/${empId}`, null);
}

export async function fetchAlerts(limit = 20): Promise<ApiAlert[]> {
  return apiFetch(`/api/alerts?limit=${limit}`, []);
}

export async function fetchAnalytics(): Promise<ApiAnalytics | null> {
  return apiFetch('/api/analytics', null);
}

export async function fetchShapExplanation(empId: string): Promise<ShapExplanation | null> {
  return apiFetch(`/api/explain/${empId}`, null);
}

export async function fetchActivity(empId?: string, limit = 50): Promise<ApiActivityEvent[]> {
  const params = new URLSearchParams();
  if (empId) params.set('emp_id', empId);
  params.set('limit', String(limit));
  return apiFetch(`/api/activity?${params.toString()}`, []);
}

// ─── Simulation API ───

export async function fetchSimulationStatus(): Promise<SimulationStatus | null> {
  return apiFetch('/api/simulate/status', null);
}

export async function simulateTick(): Promise<{ status: string; current_day: number }> {
  return apiPost('/api/simulate/tick', {}, { status: 'error', current_day: 0 });
}

export async function simulateSetSpeed(speed: number): Promise<{ status: string; speed: number }> {
  return apiPost('/api/simulate/speed', { speed }, { status: 'error', speed: 1 });
}

export async function simulateReset(): Promise<{ status: string; current_day: number }> {
  return apiPost('/api/simulate/reset', {}, { status: 'error', current_day: 30 });
}

export async function simulatePause(): Promise<{ status: string; paused: boolean }> {
  return apiPost('/api/simulate/pause', {}, { status: 'error', paused: false });
}

export async function simulateJump(day: number): Promise<{ status: string; current_day: number }> {
  return apiPost('/api/simulate/jump', { day }, { status: 'error', current_day: 30 });
}

// ─── Check if API is available ───

export async function isApiAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}
