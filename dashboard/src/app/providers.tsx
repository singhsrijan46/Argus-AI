'use client';

import { SimulationProvider } from '@/lib/SimulationContext';
import { ThemeProvider } from '@/lib/ThemeContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SimulationProvider>
        {children}
      </SimulationProvider>
    </ThemeProvider>
  );
}
