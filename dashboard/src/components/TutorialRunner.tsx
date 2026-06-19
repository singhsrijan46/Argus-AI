'use client';

import dynamic from 'next/dynamic';
import { useCallback } from 'react';
import { useTutorial } from '@/lib/TutorialContext';
import { STATUS } from 'react-joyride';
import type { EventData } from 'react-joyride';

// react-joyride uses window internally — must be loaded client-only
const Joyride = dynamic(() => import('react-joyride').then(m => m.Joyride), {
  ssr: false,
});

export default function TutorialRunner() {
  const { run, steps, setRun, stopTutorial } = useTutorial();

  const handleEvent = useCallback(
    (data: EventData) => {
      const { status } = data;
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        stopTutorial();
      }
    },
    [stopTutorial],
  );

  if (!run || steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      options={{
        primaryColor: '#2563eb',
        backgroundColor: '#1c1917',
        textColor: '#e7e5e4',
        arrowColor: '#1c1917',
        overlayColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 10000,
        buttons: ['back', 'primary', 'skip', 'close'],
        showProgress: true,
        overlayClickAction: false,
        skipBeacon: true,
        spotlightRadius: 12,
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip tutorial',
      }}
      styles={{
        tooltip: {
          borderRadius: '14px',
          padding: '20px 24px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
          maxWidth: 420,
          fontSize: '14px',
          lineHeight: '1.6',
        },
        tooltipTitle: {
          fontSize: '16px',
          fontWeight: 700,
          marginBottom: '8px',
          lineHeight: '1.3',
        },
        tooltipContent: {
          padding: '8px 0 0',
          fontSize: '13.5px',
          lineHeight: '1.65',
          color: '#d6d3d1',
          whiteSpace: 'pre-line' as const,
        },
        buttonPrimary: {
          backgroundColor: '#2563eb',
          borderRadius: '8px',
          padding: '8px 18px',
          fontSize: '13px',
          fontWeight: 600,
        },
        buttonBack: {
          color: '#a8a29e',
          fontSize: '13px',
          fontWeight: 500,
        },
        buttonSkip: {
          color: '#78716c',
          fontSize: '12px',
        },
        buttonClose: {
          color: '#78716c',
        },
        overlay: {
          mixBlendMode: undefined as any,
        },
      }}
    />
  );
}
