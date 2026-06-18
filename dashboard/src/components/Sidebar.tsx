'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, ShieldAlert, BarChart3,
  Activity, Eye, Clock,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

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

function RealtimeClock() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    setMounted(true);
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      setDate(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <div className="sidebar-clock">
        <Clock size={13} className="clock-icon" />
        <div className="clock-details">
          <span className="clock-time text-mono">--:--:--</span>
          <span className="clock-date">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar-clock">
      <Clock size={13} className="clock-icon" />
      <div className="clock-details">
        <span className="clock-time text-mono">{time}</span>
        <span className="clock-date">{date}</span>
      </div>
    </div>
  );
}

export default function Sidebar({ day, maxDay, live }: SidebarProps) {
  const pathname = usePathname();
  const progress = maxDay && day ? Math.min(100, ((day - 5) / (maxDay - 5)) * 100) : 0;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link href="/" className="sidebar-brand" style={{ textDecoration: 'none' }}>
          <div className="sidebar-logo">A</div>
          <div>
            <div className="sidebar-title">Argus</div>
            <div className="sidebar-subtitle">Threat monitoring</div>
          </div>
        </Link>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Menu</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${isActive ? 'active' : ''}`}>
              <Icon className="nav-item-icon" size={17} />
              {item.label}
            </Link>
          );
        })}

        <div className="nav-section-label" style={{ marginTop: 6 }}>Tools</div>
        {navItems2.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${isActive ? 'active' : ''}`}>
              <Icon className="nav-item-icon" size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <RealtimeClock />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="text-xs text-muted" style={{ fontWeight: 500 }}>Appearance</span>
          <ThemeToggle />
        </div>
        <div className="sidebar-status">
          <span className={`status-dot ${live ? 'status-dot--live' : 'status-dot--offline'}`} />
          <span>
            {live
              ? `Day ${day ?? '—'}/${maxDay ?? '—'} · 200 users`
              : 'Demo mode'}
          </span>
        </div>
        {live && maxDay && day && (
          <div className="sidebar-day-progress">
            <div className="sidebar-day-progress-fill" style={{ width: `${Math.max(0, progress)}%` }} />
          </div>
        )}
      </div>
    </aside>
  );
}
