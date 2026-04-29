'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/store/ui-store';

// Light-ish default strokes that are hard to see on a white canvas
const LIGHT_STROKES = new Set(['#e2e8f0', '#f8fafc', '#ffffff', '#d1d5db', '#e5e7eb']);
// Dark-ish default strokes that are hard to see on a dark canvas
const DARK_STROKES = new Set(['#1e1e1e', '#000000', '#0f172a', '#1a1a2e']);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((state) => state.theme);

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = () => {
      root.classList.remove('light', 'dark');

      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const actualTheme = theme === 'system' ? (isSystemDark ? 'dark' : 'light') : theme;
      
      root.classList.add(actualTheme);

      // Sync default stroke color so drawings are visible on the canvas
      const stroke = useUIStore.getState().currentStyle.stroke;
      if (actualTheme === 'light' && LIGHT_STROKES.has(stroke)) {
        useUIStore.getState().updateCurrentStyle({ stroke: '#1e1e1e' });
      } else if (actualTheme === 'dark' && DARK_STROKES.has(stroke)) {
        useUIStore.getState().updateCurrentStyle({ stroke: '#e2e8f0' });
      }
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  return <>{children}</>;
}
