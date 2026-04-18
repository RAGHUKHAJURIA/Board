'use client';

import React from 'react';
import { Minus, Plus, Maximize, Grid3X3, Magnet } from 'lucide-react';
import { useCanvasStore } from '@/store/canvas-store';
import { useUIStore } from '@/store/ui-store';

export function StatusBar() {
  const viewport = useCanvasStore(state => state.viewport);
  const elements = useCanvasStore(state => state.elements);
  const { updateViewport } = useCanvasStore();
  
  const grid = useUIStore(state => state.grid);
  const snap = useUIStore(state => state.snap);
  const { updateGrid, updateSnap } = useUIStore();

  const handleZoom = (delta: number) => {
    let newZoom = viewport.zoom + delta;
    newZoom = Math.max(0.1, Math.min(newZoom, 5));
    updateViewport({ zoom: newZoom });
  };

  const resetZoom = () => updateViewport({ zoom: 1, x: 0, y: 0 });

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 p-1.5 rounded-xl shadow-lg flex items-center gap-2">
      <div className="flex items-center gap-1 bg-zinc-950/50 rounded-lg p-0.5 px-2">
        <button 
          onClick={() => handleZoom(-0.1)}
          className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
        >
          <Minus size={14} />
        </button>
        <span className="text-xs font-mono w-12 text-center text-zinc-300">
          {Math.round(viewport.zoom * 100)}%
        </span>
        <button 
          onClick={() => handleZoom(0.1)}
          className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="w-[1px] h-4 bg-zinc-800" />

      <button 
        onClick={resetZoom}
        className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
        title="Reset View"
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

      <div className="w-[1px] h-4 bg-zinc-800 focus:outline" />

      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold px-2">
        {Object.keys(elements).length} Elements
      </span>
    </div>
  );
}
