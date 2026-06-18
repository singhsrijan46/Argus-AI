'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import { useSimulation } from '@/lib/hooks';

interface AppShellProps {
  title: string;
  subtitle?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}

export default function AppShell({ title, subtitle, headerExtra, children }: AppShellProps) {
  const sim = useSimulation();

  return (
    <div className="app-layout">
      <Sidebar day={sim.day} maxDay={sim.maxDay} live={sim.live} />
      <main className="main-content">
        <header className="page-header">
          <div className="page-header-inner">
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="page-title">{title}</h1>
              {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </motion.div>
            {headerExtra && (
              <motion.div
                className="page-header-actions"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
              >
                {headerExtra}
              </motion.div>
            )}
          </div>
        </header>
        <motion.div
          className="page-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
