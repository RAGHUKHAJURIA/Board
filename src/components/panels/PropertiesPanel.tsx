'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Settings, X, BringToFront, SendToBack, ArrowUpToLine, ArrowDownToLine } from 'lucide-react';
import { useCanvasStore } from '@/store/canvas-store';
import { useUIStore } from '@/store/ui-store';
import { ColorPicker } from '../toolbar/ColorPicker';
import { WhiteboardElement, ShapeType } from '@/types';

export function PropertiesPanel() {
  const elements = useCanvasStore(state => state.elements);
  const selectedIds = useCanvasStore(state => state.selectedIds);
  const { updateElement, bringToFront, sendToBack, bringForward, sendBackward } = useCanvasStore();
  
  const panels = useUIStore(state => state.panels);
  const togglePanel = useUIStore(state => state.togglePanel);

  if (!panels.properties || selectedIds.size !== 1) return null;

  const selectedId = Array.from(selectedIds)[0];
  const element = elements[selectedId!];

  if (!element) return null;

  const handleChange = (updates: Partial<WhiteboardElement>) => {
    updateElement(element.id, updates);
  };

  const handleStyleChange = (key: string, value: string | number) => {
    handleChange({ style: { ...element.style, [key]: value } });
  };

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="fixed right-4 top-20 w-64 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-xl shadow-xl flex flex-col z-30"
    >
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Settings size={16} /> Properties
        </h3>
        <button onClick={() => togglePanel('properties')} className="text-zinc-500 hover:text-zinc-300">
          <X size={16} />
        </button>
      </div>
      
      <div className="p-4 flex flex-col gap-5 max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
        
        {/* Transform Group */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">Transform</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex bg-zinc-950 border border-zinc-800 rounded overflow-hidden">
              <span className="bg-zinc-800 px-2 py-1 text-xs text-zinc-400 flex items-center">X</span>
              <input 
                type="number" 
                value={Math.round(element.x)} 
                onChange={e => handleChange({ x: parseInt(e.target.value) || 0 })}
                className="w-full bg-transparent p-1 text-xs text-white outline-none"
              />
            </div>
            <div className="flex bg-zinc-950 border border-zinc-800 rounded overflow-hidden">
              <span className="bg-zinc-800 px-2 py-1 text-xs text-zinc-400 flex items-center">Y</span>
              <input 
                type="number" 
                value={Math.round(element.y)} 
                onChange={e => handleChange({ y: parseInt(e.target.value) || 0 })}
                className="w-full bg-transparent p-1 text-xs text-white outline-none"
              />
            </div>
            
            {(element.type !== ShapeType.FREEHAND) && (
              <>
                <div className="flex bg-zinc-950 border border-zinc-800 rounded overflow-hidden">
                  <span className="bg-zinc-800 px-2 py-1 text-xs text-zinc-400 flex items-center">W</span>
                  <input 
                    type="number" 
                    value={Math.round(element.width)} 
                    onChange={e => handleChange({ width: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent p-1 text-xs text-white outline-none"
                  />
                </div>
                <div className="flex bg-zinc-950 border border-zinc-800 rounded overflow-hidden">
                  <span className="bg-zinc-800 px-2 py-1 text-xs text-zinc-400 flex items-center">H</span>
                  <input 
                    type="number" 
                    value={Math.round(element.height)} 
                    onChange={e => handleChange({ height: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent p-1 text-xs text-white outline-none"
                  />
                </div>
              </>
            )}
          </div>
          
          {(element.type !== ShapeType.FREEHAND) && (
            <div className="flex bg-zinc-950 border border-zinc-800 rounded overflow-hidden">
              <span className="bg-zinc-800 px-2 py-1 text-xs text-zinc-400 flex items-center">Rotation (deg)</span>
              <input 
                type="number" 
                value={Math.round(element.rotation * 180 / Math.PI)} 
                onChange={e => handleChange({ rotation: (parseInt(e.target.value) || 0) * Math.PI / 180 })}
                className="w-full bg-transparent p-1 text-xs text-white outline-none"
              />
            </div>
          )}
        </div>

        {/* Style Group */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">Appearance</span>
          
          <div className="flex items-center gap-4">
            <ColorPicker color={element.style.stroke} onChange={(c) => handleStyleChange('stroke', c)} label="Stroke" />
            <ColorPicker color={element.style.fill} onChange={(c) => handleStyleChange('fill', c)} label="Fill" allowTransparent />
          </div>

          <div className="flex flex-col gap-1 mt-2">
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>Stroke Width</span><span>{element.style.strokeWidth}</span>
            </div>
            <input 
              type="range" min="1" max="10" step="1"
              value={element.style.strokeWidth}
              onChange={(e) => handleStyleChange('strokeWidth', parseInt(e.target.value))}
              className="accent-violet-500"
            />
          </div>

          <div className="flex flex-col gap-1 mt-2">
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>Opacity</span><span>{Math.round(element.style.opacity * 100)}%</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.05"
              value={element.style.opacity}
              onChange={(e) => handleStyleChange('opacity', parseFloat(e.target.value))}
              className="accent-violet-500"
            />
          </div>

          <div className="flex flex-col gap-1 mt-2">
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>Roughness</span><span>{element.style.roughness}</span>
            </div>
            <input 
              type="range" min="0" max="5" step="0.5"
              value={element.style.roughness}
              onChange={(e) => handleStyleChange('roughness', parseFloat(e.target.value))}
              className="accent-violet-500"
            />
          </div>
        </div>

        {/* Arrange Group */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">Arrange</span>
          <div className="flex items-center gap-2">
            <button onClick={() => bringToFront(element.id)} className="p-2 border border-zinc-800 rounded hover:bg-zinc-800 text-zinc-300" title="Bring to Front">
              <BringToFront size={16} />
            </button>
            <button onClick={() => bringForward(element.id)} className="p-2 border border-zinc-800 rounded hover:bg-zinc-800 text-zinc-300" title="Bring Forward">
              <ArrowUpToLine size={16} />
            </button>
            <button onClick={() => sendBackward(element.id)} className="p-2 border border-zinc-800 rounded hover:bg-zinc-800 text-zinc-300" title="Send Backward">
              <ArrowDownToLine size={16} />
            </button>
            <button onClick={() => sendToBack(element.id)} className="p-2 border border-zinc-800 rounded hover:bg-zinc-800 text-zinc-300" title="Send to Back">
              <SendToBack size={16} />
            </button>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
