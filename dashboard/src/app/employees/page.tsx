'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import MockBanner from '@/components/MockBanner';
import SimulationControl from '@/components/SimulationControl';
import { employees as mockEmployees, getTrustColor, type Employee } from '@/lib/mockData';
import { useEmployees, useSimulation } from '@/lib/hooks';
import { Search, ChevronRight, ArrowUpDown } from 'lucide-react';

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 24; const w = 72;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

type SortKey = 'name' | 'department' | 'trustScore' | 'role';

export default function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('trustScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sim = useSimulation();
  const { data: liveEmployees, isMock } = useEmployees('trust_score', 'asc');

  // Map API employees to mock format, or fallback
  const employees: Employee[] = useMemo(() => {
    if (liveEmployees.length > 0) {
      return liveEmployees.map((e, i) => ({
        id: e.emp_id,
        name: e.name || e.emp_id,
        department: e.department || '',
        role: e.role || '',
        branch: e.branch || '',
        clearanceLevel: e.clearance_level || 1,
        tenureMonths: 0,
        trustScore: Math.round(e.trust_score ?? 95),
        previousTrustScore: Math.round((e.trust_score ?? 95) + 5),
        trustLevel: (e.trust_score ?? 95) < 20 ? 'CRITICAL' as const : (e.trust_score ?? 95) < 40 ? 'HIGH_RISK' as const : (e.trust_score ?? 95) < 60 ? 'MEDIUM_RISK' as const : (e.trust_score ?? 95) < 80 ? 'LOW_RISK' as const : 'TRUSTED' as const,
        avatarColor: ['#06b6d4','#8b5cf6','#f59e0b','#10b981','#ef4444','#ec4899','#3b82f6','#14b8a6','#f97316','#6366f1'][i % 10],
        isInsider: e.is_insider || false,
        lastActive: 'Live',
        twinDrift: e.twin_drift || 0,
      }));
    }
    return mockEmployees;
  }, [liveEmployees]);

  const departments = useMemo(() => ['all', ...new Set(employees.map(e => e.department))], [employees]);

  const filtered = useMemo(() => {
    let result = [...employees];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q)
      );
    }
    if (filter !== 'all') {
      result = result.filter(e => e.department === filter);
    }
    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return result;
  }, [search, filter, sortKey, sortDir, employees]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'trustScore' ? 'asc' : 'asc');
    }
  };

  return (
    <div className="app-layout">
      <Sidebar day={sim.day} maxDay={sim.maxDay} live={sim.live} />
      <main className="main-content">
        <div className="page-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-title">Employees</h1>
              <p className="page-subtitle">Monitor all employees and their behavioral trust scores</p>
            </div>
            <SimulationControl
              day={sim.day} maxDay={sim.maxDay} speed={sim.speed}
              paused={sim.paused} live={sim.live}
              onSetSpeed={sim.setSpeed} onTogglePause={sim.togglePause}
              onReset={sim.reset} onJumpTo={sim.jumpTo}
            />
          </div>
        </div>
        <div className="page-content">
          <MockBanner show={isMock} />
          {/* Search & Filter Bar */}
          <div className="flex items-center gap-16 mb-24">
            <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
              <Search size={16} style={{ color: 'var(--text-dim)' }} />
              <input
                className="search-input"
                placeholder="Search by name, ID, or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-tabs">
              {departments.map(dept => (
                <button
                  key={dept}
                  className={`filter-tab ${filter === dept ? 'active' : ''}`}
                  onClick={() => setFilter(dept)}
                >
                  {dept === 'all' ? 'All' : dept}
                </button>
              ))}
            </div>
          </div>

          {/* Employee Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="employee-table">
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>
                      <div className="flex items-center gap-4">Employee <ArrowUpDown size={12} /></div>
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('department')}>
                      <div className="flex items-center gap-4">Department <ArrowUpDown size={12} /></div>
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('role')}>
                      <div className="flex items-center gap-4">Role <ArrowUpDown size={12} /></div>
                    </th>
                    <th>Branch</th>
                    <th>Clearance</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('trustScore')}>
                      <div className="flex items-center gap-4">Trust Score <ArrowUpDown size={12} /></div>
                    </th>
                    <th>Trend</th>
                    <th>Twin Drift</th>
                    <th>Last Active</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => {
                    const color = getTrustColor(emp.trustScore);
                    const initials = emp.name.split(' ').map(n => n[0]).join('');
                    return (
                      <tr key={emp.id}>
                        <td>
                          <div className="employee-name-cell">
                            <div className="avatar" style={{ background: emp.avatarColor }}>{initials}</div>
                            <div>
                              <div className="font-semibold">{emp.name}</div>
                              <div className="text-xs text-muted text-mono">{emp.id}</div>
                            </div>
                          </div>
                        </td>
                        <td>{emp.department}</td>
                        <td><span className="text-muted">{emp.role}</span></td>
                        <td><span className="text-muted">{emp.branch}</span></td>
                        <td>
                          <div className="flex items-center gap-4">
                            {'●'.repeat(emp.clearanceLevel)}
                            <span className="text-xs text-muted">{'○'.repeat(5 - emp.clearanceLevel)}</span>
                          </div>
                        </td>
                        <td>
                          <span className="trust-badge" style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                            {emp.trustScore}
                          </span>
                        </td>
                        <td>
                          <span className="text-mono text-sm" style={{ color: emp.twinDrift > 0.3 ? '#ef4444' : emp.twinDrift > 0.1 ? '#eab308' : 'var(--text-muted)' }}>
                            {emp.twinDrift > 0.01 ? emp.twinDrift.toFixed(2) : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-mono text-sm" style={{ color: emp.twinDrift > 0.5 ? '#ef4444' : emp.twinDrift > 0.1 ? '#eab308' : 'var(--text-muted)' }}>
                            {emp.twinDrift.toFixed(2)}
                          </span>
                        </td>
                        <td><span className="text-xs text-muted">{emp.lastActive}</span></td>
                        <td>
                          <Link href={`/employee/${emp.id}`} style={{ color: 'var(--text-dim)' }}>
                            <ChevronRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
