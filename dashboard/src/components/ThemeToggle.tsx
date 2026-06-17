'use client';

import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <motion.div
        className="theme-toggle-track"
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      >
        <motion.div
          className="theme-toggle-thumb"
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          style={{ left: isDark ? 'calc(100% - 26px)' : '2px' }}
        >
          <motion.span
            key={isDark ? 'moon' : 'sun'}
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            {isDark ? <Moon size={13} /> : <Sun size={13} />}
          </motion.span>
        </motion.div>
        <Sun size={12} className="theme-toggle-icon theme-toggle-icon--left" />
        <Moon size={12} className="theme-toggle-icon theme-toggle-icon--right" />
      </motion.div>
    </button>
  );
}
