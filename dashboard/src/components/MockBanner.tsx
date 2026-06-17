'use client';

import { AlertTriangle } from 'lucide-react';

interface MockBannerProps {
  show: boolean;
  message?: string;
}

export default function MockBanner({ show, message }: MockBannerProps) {
  if (!show) return null;

  return (
    <div className="mock-banner">
      <AlertTriangle size={15} style={{ flexShrink: 0 }} />
      <span>
        {message || 'Showing demo data — start the backend for live monitoring.'}
      </span>
      <span className="mock-banner-tag">DEMO</span>
    </div>
  );
}
