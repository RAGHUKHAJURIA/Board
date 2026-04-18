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
    <main className="w-screen h-screen overflow-hidden bg-zinc-950 text-zinc-50 flex flex-col relative select-none">
      <AdvancedToolbar />
      <LayersPanel />
      <PropertiesPanel />
      <div className="flex-1 w-full h-full relative cursor-crosshair">
        <Canvas />
      </div>
      <StatusBar />
    </main>
  );
}
