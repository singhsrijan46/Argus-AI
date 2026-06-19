'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Step } from 'react-joyride';

/* ═══════════════════════════════════════════════════════════════
   Tutorial step definitions — one array per route
   ═══════════════════════════════════════════════════════════════ */

export const TUTORIALS: Record<string, Step[]> = {
  /* ── Overview / Dashboard ─────────────────────────────────── */
  '/': [
    {
      target: '.sidebar-brand',
      content:
        'Welcome to Argus AI — your insider threat intelligence dashboard. This sidebar is your main navigation hub. Click any item to switch between pages.',
      title: '👋 Welcome to Argus AI',
      placement: 'right',
      skipBeacon: true,
    },
    {
      target: '.mission-time-bar',
      content:
        'This is the Mission Time Bar. It shows the current simulation day and time. You can control playback speed, pause/resume the simulation, jump to a specific day, or reset back to Day 30.',
      title: '⏱️ Simulation Controls',
      placement: 'bottom',
    },
    {
      target: '.metrics-grid',
      content:
        'These stat cards give you a quick snapshot of the system\'s health: total employees monitored, active threat count, the ensemble model\'s F1 score, and false positive rate. Click any card to navigate to its detailed page.',
      title: '📊 Key Metrics at a Glance',
      placement: 'bottom',
    },
    {
      target: '.heatmap-grid',
      content:
        'The Trust Heatmap visualizes every employee as a colored cell. Colors range from blue (trusted) to red (critical). Each cell shows initials and a trust score. Click any cell to drill into that employee\'s detail page.',
      title: '🔥 Employee Trust Heatmap',
      placement: 'top',
    },
    {
      target: '.alerts-container',
      content:
        'This panel shows active alerts ordered by severity. Each alert shows the employee name, department, intent chain pattern (e.g. Data Exfiltration), and their current trust score. Click an alert to view the employee\'s full profile.',
      title: '🚨 Active Alerts',
      placement: 'left',
    },
    {
      target: '.donut-wrapper',
      content:
        'This doughnut chart breaks down all employees by trust level — Trusted, Low Risk, Medium, High Risk, and Critical. The center shows the total headcount.',
      title: '🍩 Trust Distribution',
      placement: 'right',
    },
    {
      target: '.feed-container',
      content:
        'The activity feed shows real-time behavioral events as they happen — logins, file access, USB connections, emails, and more. Each event has a risk contribution score. Higher scores mean more suspicious activity.',
      title: '📡 Live Activity Feed',
      placement: 'top',
    },
  ],

  /* ── Employees ────────────────────────────────────────────── */
  '/employees': [
    {
      target: '.search-bar',
      content:
        'Use this search bar to find employees by name, employee ID, or role. Results update instantly as you type.',
      title: '🔍 Search Employees',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '.filter-tabs',
      content:
        'Filter the table by department. Click "All" to see everyone, or pick a specific department to narrow down the list.',
      title: '🏷️ Department Filters',
      placement: 'bottom',
    },
    {
      target: '.employee-table',
      content:
        'The employee table shows every monitored individual with their department, role, branch, clearance level (L1-L5), trust score, sparkline trend, twin drift value, and last active time. Click any column header to sort.',
      title: '📋 Employee Table',
      placement: 'top',
    },
    {
      target: '.trust-badge',
      content:
        'Each employee\'s trust score is color-coded: blue (80-100 = Trusted), green (60-79 = Low Risk), amber (40-59 = Medium), orange (20-39 = High Risk), and red (0-19 = Critical). Scores update in real-time as the simulation advances.',
      title: '🎯 Trust Score Badges',
      placement: 'left',
    },
    {
      target: '.clearance-indicator',
      content:
        'The clearance level shows how much sensitive data this employee can access (L1 = minimal, L5 = maximum). Higher clearance combined with low trust is a critical risk signal.',
      title: '🔐 Clearance Levels',
      placement: 'left',
    },
  ],

  /* ── Alerts ───────────────────────────────────────────────── */
  '/alerts': [
    {
      target: '.filter-tabs',
      content:
        'Filter alerts by status: All, Active (needs attention), Investigating (under review), or Resolved. Most alerts start as "Active" and should be triaged.',
      title: '📂 Alert Status Filters',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '.alerts-page-list',
      content:
        'Each alert card shows the severity (Critical/High/Medium), the employee\'s name, department, and their current trust score. Click any card to expand it and see detailed risk factors, intent signal chains, and recommended actions.',
      title: '🚨 Alert Cards',
      placement: 'top',
    },
    {
      target: '.alerts-card',
      content:
        'Expand an alert to see three key sections:\n\n• Risk Factors — the top behavioral anomalies driving this alert (e.g. after-hours access, USB file transfers)\n\n• Intent Signal Chain — the specific attack pattern detected (e.g. Data Exfiltration: bulk download → USB connect → file copy)\n\n• Recommended Action — an automated playbook suggestion (e.g. suspend session, escalate to CISO)',
      title: '🔎 Alert Deep Dive',
      placement: 'top',
    },
    {
      target: '.alerts-severity',
      content:
        'Alert severity is computed from the trust score, drift velocity, and matched intent chains:\n\n• CRITICAL (red) — Trust < 20, immediate action required\n• HIGH (orange) — Trust 20-39, step-up auth + SOC review\n• MEDIUM (amber) — Trust 40-59, increase monitoring',
      title: '⚡ Severity Levels',
      placement: 'right',
    },
  ],

  /* ── Analytics ────────────────────────────────────────────── */
  '/analytics': [
    {
      target: '.analytics-performance',
      content:
        'The detection performance section shows five key model health metrics in real-time: F1 Score (balanced quality), Precision (signal purity), Recall (threat coverage), AUC-ROC (classifier separation), and FPR (false positive rate). Each bar fills based on proximity to its target.',
      title: '📈 Detection Performance',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '.analytics-metric-grid',
      content:
        'Each metric card shows the current value, a visual progress bar, and a status indicator (Healthy or Controlled). The ensemble model (LightGBM + XGBoost + LSTM-AE + Isolation Forest) refreshes these metrics every simulation day.',
      title: '🧮 Metric Cards',
      placement: 'bottom',
    },
    {
      target: '.analytics-chart-grid',
      content:
        'Two charts side by side:\n\n• ROC Curve — compares the live ensemble model against a reference model and the random baseline. The shaded area shows AUC.\n\n• Detection Rate by Scenario — horizontal bars showing how well the model catches each attack type (Data Exfil, Privilege Escalation, Credential Compromise, etc.)',
      title: '📊 Performance Charts',
      placement: 'top',
    },
    {
      target: '.analytics-chart-card--wide',
      content:
        'This time-series chart plots F1, Precision, and Recall over the last 8 simulation days. Watch for trends — if recall drops while precision stays high, the model may be missing new attack patterns.',
      title: '📉 Model Performance Over Time',
      placement: 'top',
    },
    {
      target: '.card-header',
      content:
        'The ablation study table compares five model architectures: Hybrid (LSTM+IF), LSTM Only, Isolation Forest, XGBoost, and Random Forest. The "BEST" tag highlights the winning model. This helps you understand why the hybrid approach outperforms individual models.',
      title: '🏆 Model Comparison (Ablation)',
      placement: 'top',
    },
  ],

  /* ── Activity / Live Feed ─────────────────────────────────── */
  '/activity': [
    {
      target: '.filter-tabs',
      content:
        'Filter events by risk level: All, Critical (risk > 85), High (60-85), Medium (20-60), or Low (< 20). This helps SOC analysts focus on the most suspicious events first.',
      title: '🎚️ Risk Level Filters',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '.pill',
      content:
        'This pill shows whether you\'re viewing live API data or demo data. When connected to the backend, it shows the current simulation day and total event count.',
      title: '🔴 Connection Status',
      placement: 'bottom',
    },
    {
      target: '.feed-container',
      content:
        'Each event row shows:\n\n• Timestamp — when the action occurred\n• Icon — visual indicator (🔑 login, 🌙 after-hours, 💾 USB, 📧 email, 💀 privilege escalation)\n• Employee — who performed the action\n• Detail — what they did and on which system\n• Risk Score — numeric risk contribution (0-100)\n\nHigh-risk events are color-coded red/orange.',
      title: '📡 Event Stream',
      placement: 'top',
    },
  ],

  /* ── Digital Twin ─────────────────────────────────────────── */
  '/twin': [
    {
      target: '.twin-hero',
      content:
        'A Digital Employee Twin is a compact behavioral baseline — it models how an employee normally works across four dimensions: circadian rhythm, access patterns, feature baselines, and drift velocity. When actual behavior deviates from the twin, the system raises alerts.',
      title: '🧬 What is a Digital Twin?',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '.twin-dimension-grid',
      content:
        'Each twin is built from four behavioral dimensions:\n\n• Circadian Profile (8 dims) — login/logout timing patterns\n• Access Graph (16 dims) — which systems and resources they touch\n• Behavior Baseline (94 dims) — rolling 7-day feature averages\n• Drift Velocity (1 dim) — how fast behavior is changing',
      title: '🧩 Twin Dimensions',
      placement: 'top',
    },
    {
      target: '.twin-summary-grid',
      content:
        'Summary cards show stable twins (drift ≤ 0.30), high-drift twins (drift > 0.30), and total profiles monitored. High drift is a leading indicator — it often appears days before trust scores drop.',
      title: '📊 Twin Summary',
      placement: 'bottom',
    },
    {
      target: '.twin-section-heading',
      content:
        'High-drift employees are sorted by drift magnitude. Each card shows the employee name, department, trust score, and a drift progress bar. Click any card to view their full employee profile with radar chart, SHAP explainability, and timeline.',
      title: '⚠️ High Drift Employees',
      placement: 'bottom',
    },
  ],

  /* ── Employee Detail (dynamic route) ──────────────────────── */
  '/employee/[id]': [
    {
      target: '.card-glow-red, .card-glow-cyan',
      content:
        'The employee header card shows their name, role, department, branch, and clearance level. The large number on the right is their current trust score — glowing red for high-risk employees, cyan for trusted ones.',
      title: '👤 Employee Header',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '.card-title',
      content:
        'The Digital Twin Comparison uses a radar chart to overlay the employee\'s expected behavior (cyan) against their actual behavior (red). Large gaps between the two shapes indicate behavioral anomalies worth investigating.',
      title: '🕸️ Twin Radar Comparison',
      placement: 'bottom',
    },
    {
      target: '.employee-genome',
      content:
        'The Behavioral Genome Deviation table compares expected vs. actual values for: login time, records accessed per day, data volume (MB), devices used, and systems touched. The "delta" column flags significant deviations.',
      title: '🧬 Behavioral Genome',
      placement: 'top',
    },
    {
      target: '.employee-timeline-card',
      content:
        'The Privilege Decay Timeline plots trust score over time. Watch for sharp drops — these correspond to real behavioral anomalies detected by the ML models. Events are annotated directly on the chart.',
      title: '📉 Privilege Decay Timeline',
      placement: 'top',
    },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   Context — lets the sidebar trigger tutorials on the active page
   ═══════════════════════════════════════════════════════════════ */

interface TutorialState {
  /** Whether the joyride tour is running */
  run: boolean;
  /** Steps for the current page */
  steps: Step[];
  /** Start the tutorial for a given route */
  startTutorial: (route: string) => void;
  /** Stop / reset the tutorial */
  stopTutorial: () => void;
  /** Set run state (used by Joyride callbacks) */
  setRun: (run: boolean) => void;
}

const TutorialContext = createContext<TutorialState>({
  run: false,
  steps: [],
  startTutorial: () => {},
  stopTutorial: () => {},
  setRun: () => {},
});

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  const startTutorial = useCallback((route: string) => {
    // Try exact match first, then try the dynamic pattern
    let tutorialSteps = TUTORIALS[route];
    if (!tutorialSteps) {
      // Match /employee/[anything] to /employee/[id]
      if (route.startsWith('/employee/')) {
        tutorialSteps = TUTORIALS['/employee/[id]'];
      }
    }
    if (tutorialSteps && tutorialSteps.length > 0) {
      setSteps(tutorialSteps);
      // Small delay to let DOM settle before joyride scans targets
      setTimeout(() => setRun(true), 300);
    }
  }, []);

  const stopTutorial = useCallback(() => {
    setRun(false);
  }, []);

  return (
    <TutorialContext.Provider value={{ run, steps, startTutorial, stopTutorial, setRun }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  return useContext(TutorialContext);
}
