'use client';

import React from 'react';
import { Canvas } from '@/components/canvas/Canvas';
import { AdvancedToolbar } from '@/components/toolbar/AdvancedToolbar';
import { PropertiesPanel } from '@/components/panels/PropertiesPanel';
import { LayersPanel } from '@/components/panels/LayersPanel';
import { StatusBar } from '@/components/shared/StatusBar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function BoardPage() {
  // Initialize global keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <main className="w-screen h-screen overflow-hidden bg-zinc-950 text-zinc-50 relative select-none">
      {/* Toolbar - fixed, not inside canvas */}
      <AdvancedToolbar />

      {/* Panels - fixed, not inside canvas */}
      <LayersPanel />
      <PropertiesPanel />

      {/* Canvas fills the whole screen */}
      <Canvas />

      {/* Status bar */}
      <StatusBar />
    </main>
  );
}
