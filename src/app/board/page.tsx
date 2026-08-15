'use client';

import React from 'react';
import { Canvas } from '@/components/canvas/Canvas';
import { AdvancedToolbar } from '@/components/toolbar/AdvancedToolbar';
import { PropertiesPanel } from '@/components/panels/PropertiesPanel';
import { LayersPanel } from '@/components/panels/LayersPanel';
import { StatusBar } from '@/components/shared/StatusBar';
import { MainMenu } from '@/components/shared/MainMenu';
import { ExportDialog } from '@/components/shared/ExportDialog';
import { HelpDialog } from '@/components/shared/HelpDialog';
import { InputModeToggle } from '@/components/ui/InputModeToggle';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useUIStore } from '@/store/ui-store';

export default function BoardPage() {
  // Initialize global keyboard shortcuts
  useKeyboardShortcuts();

  // Modals live here rather than inside the menu so the keyboard can open them
  // whether or not the menu has ever been opened.
  const dialog = useUIStore(state => state.dialog);
  const setDialog = useUIStore(state => state.setDialog);
  const closeDialog = () => setDialog(null);

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

      {dialog === 'export' && <ExportDialog onClose={closeDialog} />}
      {dialog === 'help' && <HelpDialog onClose={closeDialog} />}
    </main>
  );
}
