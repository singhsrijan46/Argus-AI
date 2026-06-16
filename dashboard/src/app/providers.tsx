'use client';

import { SimulationProvider } from '@/lib/SimulationContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SimulationProvider>
      {children}
    </SimulationProvider>
  );
}
