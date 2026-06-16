'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, ShieldAlert, BarChart3,
  Activity, Eye,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/alerts', label: 'Alerts', icon: ShieldAlert },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const navItems2 = [
  { href: '/twin', label: 'Digital Twin', icon: Eye },
  { href: '/activity', label: 'Live Feed', icon: Activity },
];

interface SidebarProps {
  day?: number;
  maxDay?: number;
  live?: boolean;
}

export default function Sidebar({ day, maxDay, live }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-logo">🔱</div>
          <div>
            <div className="sidebar-title">Argus AI</div>
            <div className="sidebar-subtitle">Insider Threat Intel</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon className="nav-item-icon" size={18} />
              {item.label}
            </Link>
          );
        })}

        <div className="nav-section-label" style={{ marginTop: 8 }}>Intelligence</div>
        {navItems2.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon className="nav-item-icon" size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-status">
          <span className="status-dot" style={{
            background: live ? '#22c55e' : '#f59e0b',
            boxShadow: live ? '0 0 6px rgba(34,197,94,0.5)' : '0 0 6px rgba(245,158,11,0.5)',
          }} />
          <span>
            {live
              ? `Day ${day ?? '—'}/${maxDay ?? '—'} · 200 monitored`
              : 'Offline — Using demo data'}
          </span>
        </div>
      </div>
    </aside>
  );
}
