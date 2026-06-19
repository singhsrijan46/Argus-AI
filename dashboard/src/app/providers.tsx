'use client';

import { SimulationProvider } from '@/lib/SimulationContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import { TutorialProvider } from '@/lib/TutorialContext';
import TutorialRunner from '@/components/TutorialRunner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SimulationProvider>
        <TutorialProvider>
          {children}
          <TutorialRunner />
        </TutorialProvider>
      </SimulationProvider>
    </ThemeProvider>
  );
}
