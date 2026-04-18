'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Layers, X, Square, Circle, Triangle, Minus, ArrowRight, Pen, Hexagon, Download, FileJson } from 'lucide-react';
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

  if (!panels.layers) return null;

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
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      className="fixed left-4 top-20 w-64 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-xl shadow-xl flex flex-col z-30"
    >
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Layers size={16} /> Layers
        </h3>
        <button onClick={() => togglePanel('layers')} className="text-zinc-500 hover:text-zinc-300">
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
                ${isSelected ? 'bg-violet-600/20 text-violet-300' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}
              `}
            >
              <div className={isSelected ? 'text-violet-400' : 'text-zinc-500'}>
                {getIcon(element.type)}
              </div>
              <span className="truncate flex-1">{getLabel(element.type)}</span>
            </div>
          );
        })}
      </div>
      
      <div className="p-3 border-t border-zinc-800 flex gap-2">
        <button 
          onClick={() => exportToPNG({ elements: Object.values(elements), grid })}
          className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2 rounded"
        >
          <Download size={14} /> PNG
        </button>
        <button 
          onClick={() => exportToJSON(elements)}
          className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2 rounded"
        >
          <FileJson size={14} /> JSON
        </button>
      </div>
    </motion.div>
  );
}
