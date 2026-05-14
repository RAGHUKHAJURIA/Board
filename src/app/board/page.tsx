'use client';

import React from 'react';
import { Canvas } from '@/components/canvas/Canvas';
import { AdvancedToolbar } from '@/components/toolbar/AdvancedToolbar';
import { PropertiesPanel } from '@/components/panels/PropertiesPanel';
import { LayersPanel } from '@/components/panels/LayersPanel';
import { StatusBar } from '@/components/shared/StatusBar';
import { MainMenu } from '@/components/shared/MainMenu';
import { InputModeToggle } from '@/components/ui/InputModeToggle';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function BoardPage() {
  // Initialize global keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <main className="w-screen app-height overflow-hidden bg-background text-foreground relative select-none safe-bottom safe-left safe-right">
      {/* Main Menu (Hamburger) */}
      <MainMenu />
      {/* Toolbar - fixed, not inside canvas */}
      <AdvancedToolbar />

      {/* Panels - fixed, not inside canvas */}
      <LayersPanel />
      <PropertiesPanel />

      {/* Canvas fills the whole screen */}
      <Canvas />

      <InputModeToggle />

      {/* Status bar */}
      <StatusBar />
    </main>
  );
}
