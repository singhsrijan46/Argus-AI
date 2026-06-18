'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type PanelVariant = 'default' | 'danger' | 'accent';

interface PanelProps {
  title: string;
  icon?: LucideIcon;
  badge?: ReactNode;
  children: ReactNode;
  variant?: PanelVariant;
  delay?: number;
  className?: string;
  noPadding?: boolean;
}

export default function Panel({
  title,
  icon: Icon,
  badge,
  children,
  variant = 'default',
  delay = 0,
  className = '',
  noPadding = false,
}: PanelProps) {
  return (
    <motion.section
      className={`panel panel--${variant} ${className}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <header className="panel-header">
        <div className="panel-title">
          {Icon && (
            <span className={`panel-icon panel-icon--${variant}`}>
              <Icon size={16} />
            </span>
          )}
          {title}
        </div>
        {badge}
      </header>
      <div className={noPadding ? 'panel-body panel-body--flush' : 'panel-body'}>
        {children}
      </div>
    </motion.section>
  );
}
