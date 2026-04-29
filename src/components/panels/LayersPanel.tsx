'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Layers, X, Square, Circle, Triangle, Minus, ArrowRight, Pen, Hexagon, Download, FileJson, GripHorizontal, ChevronLeft } from 'lucide-react';
import { useCanvasStore } from '@/store/canvas-store';
import { useUIStore } from '@/store/ui-store';
import { ShapeType } from '@/types';
import { exportToPNG } from '@/lib/export/png';
import { exportToJSON } from '@/lib/export/json';

export function LayersPanel() {
  const elements = useCanvasStore(state => state.elements);
  const selectedIds = useCanvasStore(state => state.selectedIds);
  const { selectElements } = useCanvasStore();
  
  const panels = useUIStore(state => state.panels);
  const grid = useUIStore(state => state.grid);
  const togglePanel = useUIStore(state => state.togglePanel);

  if (!panels.layers) {
    return (
      <button 
        onClick={() => togglePanel('layers')}
        className="fixed right-0 top-32 bg-white/90 dark:bg-[#1a1a1e]/90 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 border-r-0 rounded-l-lg p-2 py-3 text-zinc-500 dark:text-zinc-400 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-200 dark:bg-zinc-800 shadow-xl z-40 pointer-events-auto flex items-center gap-1 transition-all"
        title="Restore Layers Panel"
      >
        <ChevronLeft size={16} />
        <Layers size={16} />
      </button>
    );
  }

  // Render elements in reverse z-index order (top on top)
  const sortedElements = Object.values(elements).sort((a, b) => b.zIndex - a.zIndex);

  const getIcon = (type: ShapeType) => {
    switch(type) {
      case ShapeType.RECTANGLE: return <Square size={14} />;
      case ShapeType.CIRCLE:
      case ShapeType.ELLIPSE: return <Circle size={14} />;
      case ShapeType.TRIANGLE: return <Triangle size={14} />;
      case ShapeType.LINE: return <Minus size={14} />;
      case ShapeType.ARROW: return <ArrowRight size={14} />;
      case ShapeType.FREEHAND: return <Pen size={14} />;
      case ShapeType.HEXAGON:
      case ShapeType.PENTAGON: return <Hexagon size={14} />;
      default: return <Square size={14} />;
    }
  };

  const getLabel = (type: ShapeType) => {
    switch(type) {
      case ShapeType.FREEHAND: return 'Drawing';
      case ShapeType.RECTANGLE: return 'Rectangle';
      case ShapeType.CIRCLE: return 'Circle';
      case ShapeType.ELLIPSE: return 'Ellipse';
      case ShapeType.TRIANGLE: return 'Triangle';
      case ShapeType.DIAMOND: return 'Diamond';
      case ShapeType.LINE: return 'Line';
      case ShapeType.ARROW: return 'Arrow';
      default: return 'Element';
    }
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="fixed left-20 top-20 w-64 bg-white/90 dark:bg-[#1a1a1e]/90 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl flex flex-col z-30 pointer-events-auto"
    >
      <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800 cursor-grab active:cursor-grabbing">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <GripHorizontal size={14} className="text-zinc-500" />
          <Layers size={16} /> Layers
        </h3>
        <button onClick={() => togglePanel('layers')} className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-300">
          <X size={16} />
        </button>
      </div>
      
      <div className="p-2 flex flex-col gap-1 max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
        {sortedElements.length === 0 && (
          <div className="text-xs text-zinc-500 text-center py-4">No elements yet</div>
        )}
        {sortedElements.map(element => {
          const isSelected = selectedIds.has(element.id);
          return (
            <div 
              key={element.id}
              onClick={(e) => {
                if (e.shiftKey) {
                  const newSet = new Set(selectedIds);
                  if (newSet.has(element.id)) newSet.delete(element.id);
                  else newSet.add(element.id);
                  selectElements(Array.from(newSet));
                } else {
                  selectElements([element.id]);
                }
              }}
              className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm
                ${isSelected ? 'bg-foreground text-background font-medium' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-200 dark:bg-zinc-800 hover:text-foreground'}
              `}
            >
              <div className={isSelected ? 'text-background' : 'text-zinc-500'}>
                {getIcon(element.type)}
              </div>
              <span className="truncate flex-1">{getLabel(element.type)}</span>
            </div>
          );
        })}
      </div>
      
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
        <button 
          onClick={() => exportToPNG({ elements: Object.values(elements), grid })}
          className="flex-1 flex items-center justify-center gap-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs py-2 rounded"
        >
          <Download size={14} /> PNG
        </button>
        <button 
          onClick={() => exportToJSON(elements)}
          className="flex-1 flex items-center justify-center gap-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs py-2 rounded"
        >
          <FileJson size={14} /> JSON
        </button>
      </div>
    </motion.div>
  );
}
