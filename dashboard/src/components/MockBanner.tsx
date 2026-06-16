'use client';

import { AlertTriangle } from 'lucide-react';

interface MockBannerProps {
  show: boolean;
  message?: string;
}

export default function MockBanner({ show, message }: MockBannerProps) {
  if (!show) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 14px', borderRadius: 'var(--radius-md)',
      background: 'rgba(245, 158, 11, 0.08)',
      border: '1px solid rgba(245, 158, 11, 0.25)',
      marginBottom: 16,
      animation: 'fadeIn 0.3s ease',
    }}>
      <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
      <span style={{
        fontSize: 11, color: '#fbbf24', fontWeight: 600,
        fontFamily: 'Inter, sans-serif',
      }}>
        {message || 'API Unavailable — Displaying demo data. Start the backend server for live data.'}
      </span>
      <span style={{
        marginLeft: 'auto', fontSize: 9, padding: '2px 6px',
        borderRadius: 'var(--radius-sm)', background: 'rgba(245, 158, 11, 0.15)',
        color: '#f59e0b', fontWeight: 700, letterSpacing: '0.05em',
        flexShrink: 0,
      }}>
        MOCK DATA
      </span>
    </div>
  );
}
