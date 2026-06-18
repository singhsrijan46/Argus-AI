'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type StatVariant = 'blue' | 'red' | 'violet' | 'green';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  hintTone?: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  variant?: StatVariant;
  delay?: number;
  href?: string;
}

export default function StatCard({
  label,
  value,
  hint,
  hintTone = 'neutral',
  icon: Icon,
  variant = 'blue',
  delay = 0,
  href,
}: StatCardProps) {
  const cardContent = (
    <motion.article
      className={`stat-card stat-card--${variant}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileTap={{ scale: 0.99 }}
      style={{ cursor: href ? 'pointer' : 'default' }}
    >
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        <span className={`stat-card-icon stat-card-icon--${variant}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="stat-card-value">{value}</div>
      {hint && (
        <div className={`stat-card-hint stat-card-hint--${hintTone}`}>{hint}</div>
      )}
    </motion.article>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none' }}>
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
