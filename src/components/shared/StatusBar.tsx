'use client';

import React from 'react';
import { Minus, Plus, Maximize, Grid3X3, Magnet } from 'lucide-react';
import { useCanvasStore } from '@/store/canvas-store';
import { useUIStore } from '@/store/ui-store';

export function StatusBar() {
  const viewport = useCanvasStore(state => state.viewport);
  const elements = useCanvasStore(state => state.elements);
  const selectedIds = useCanvasStore(state => state.selectedIds);
  const { setZoom, zoomToFit } = useCanvasStore();

  const grid = useUIStore(state => state.grid);
  const snap = useUIStore(state => state.snap);
  const { updateGrid, updateSnap } = useUIStore();

  const handleZoom = (factor: number) => {
    setZoom(viewport.zoom * factor);
  };

  const resetZoom = () => setZoom(1);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 p-1.5 rounded-xl shadow-lg flex items-center gap-2">
      <div className="flex items-center gap-1 bg-zinc-950/50 rounded-lg p-0.5 px-2">
        <button
          onClick={() => handleZoom(1 / 1.25)}
          className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
          title="Zoom Out (Ctrl+-)"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={resetZoom}
          className="text-xs font-mono w-14 text-center text-zinc-300 hover:text-white hover:bg-zinc-800 rounded py-0.5"
          title="Reset Zoom (Ctrl+0)"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>
        <button
          onClick={() => handleZoom(1.25)}
          className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
          title="Zoom In (Ctrl++)"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="w-[1px] h-4 bg-zinc-800" />

      <button
        onClick={zoomToFit}
        className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
        title="Zoom to Fit (Ctrl+1)"
      >
        <Maximize size={14} />
      </button>

      <button
        onClick={() => updateGrid({ enabled: !grid.enabled })}
        className={`p-1.5 rounded transition-colors ${grid.enabled ? 'bg-violet-600/20 text-violet-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
        title="Toggle Grid"
      >
        <Grid3X3 size={14} />
      </button>

      <button
        onClick={() => updateSnap({ enabled: !snap.enabled })}
        className={`p-1.5 rounded transition-colors ${snap.enabled ? 'bg-violet-600/20 text-violet-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
        title="Toggle Snapping"
      >
        <Magnet size={14} />
      </button>

      <div className="w-[1px] h-4 bg-zinc-800" />

      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold px-2">
        {Object.keys(elements).length} Elements
        {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
      </span>
    </div>
  );
}
