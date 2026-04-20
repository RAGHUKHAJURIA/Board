'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Settings, X, BringToFront, SendToBack,
  ArrowUpToLine, ArrowDownToLine,
  AlignLeft, AlignCenter, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  GripHorizontal, ChevronLeft
} from 'lucide-react';
import { useCanvasStore } from '@/store/canvas-store';
import { useUIStore } from '@/store/ui-store';
import { ColorPicker } from '../toolbar/ColorPicker';
import { WhiteboardElement, ShapeType } from '@/types';

export function PropertiesPanel() {
  const elements = useCanvasStore(state => state.elements);
  const selectedIds = useCanvasStore(state => state.selectedIds);
  const { updateElement, bringToFront, sendToBack, bringForward, sendBackward, alignElements } = useCanvasStore();

  const panels = useUIStore(state => state.panels);
  const togglePanel = useUIStore(state => state.togglePanel);

  if (!panels.properties) {
    return (
      <button 
        onClick={() => togglePanel('properties')}
        className="fixed right-0 top-20 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 border-r-0 rounded-l-lg p-2 py-3 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 shadow-xl z-40 pointer-events-auto flex items-center gap-1 transition-all"
        title="Restore Properties Panel"
      >
        <ChevronLeft size={16} />
        <Settings size={16} />
      </button>
    );
  }
  if (selectedIds.size === 0) return null;

  const selectedId = Array.from(selectedIds)[0]!;
  const element = elements[selectedId];

  if (!element) return null;

  const handleChange = (updates: Partial<WhiteboardElement>) => {
    updateElement(element.id, updates);
  };

  const handleStyleChange = (key: string, value: string | number) => {
    handleChange({ style: { ...element.style, [key]: value } });
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="fixed right-4 top-20 w-64 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-xl flex flex-col z-30 pointer-events-auto"
    >
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 cursor-grab active:cursor-grabbing">
        <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <GripHorizontal size={14} className="text-zinc-500" />
          <Settings size={16} />
          Properties
          {selectedIds.size > 1 && <span className="text-zinc-500 text-xs">({selectedIds.size})</span>}
        </h3>
        <button onClick={() => togglePanel('properties')} className="text-zinc-500 hover:text-zinc-300">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-5">

        {/* Transform */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">Transform</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex bg-zinc-950 border border-zinc-800 rounded overflow-hidden">
              <span className="bg-zinc-800 px-2 py-1 text-xs text-zinc-400 flex items-center">X</span>
              <input
                type="number"
                value={Math.round(element.x)}
                onChange={e => handleChange({ x: parseFloat(e.target.value) || 0 })}
                className="w-full bg-transparent p-1 text-xs text-white outline-none"
              />
            </div>
            <div className="flex bg-zinc-950 border border-zinc-800 rounded overflow-hidden">
              <span className="bg-zinc-800 px-2 py-1 text-xs text-zinc-400 flex items-center">Y</span>
              <input
                type="number"
                value={Math.round(element.y)}
                onChange={e => handleChange({ y: parseFloat(e.target.value) || 0 })}
                className="w-full bg-transparent p-1 text-xs text-white outline-none"
              />
            </div>

            {element.type !== ShapeType.FREEHAND && (
              <>
                <div className="flex bg-zinc-950 border border-zinc-800 rounded overflow-hidden">
                  <span className="bg-zinc-800 px-2 py-1 text-xs text-zinc-400 flex items-center">W</span>
                  <input
                    type="number"
                    value={Math.round(Math.abs(element.width))}
                    onChange={e => handleChange({ width: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-transparent p-1 text-xs text-white outline-none"
                  />
                </div>
                <div className="flex bg-zinc-950 border border-zinc-800 rounded overflow-hidden">
                  <span className="bg-zinc-800 px-2 py-1 text-xs text-zinc-400 flex items-center">H</span>
                  <input
                    type="number"
                    value={Math.round(Math.abs(element.height))}
                    onChange={e => handleChange({ height: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-transparent p-1 text-xs text-white outline-none"
                  />
                </div>
              </>
            )}
          </div>

          {element.type !== ShapeType.FREEHAND && (
            <div className="flex bg-zinc-950 border border-zinc-800 rounded overflow-hidden">
              <span className="bg-zinc-800 px-2 py-1 text-xs text-zinc-400 flex items-center shrink-0">Rotation°</span>
              <input
                type="number"
                value={Math.round((element.rotation || 0) * 180 / Math.PI)}
                onChange={e => handleChange({ rotation: ((parseFloat(e.target.value) || 0) * Math.PI / 180) })}
                className="w-full bg-transparent p-1 text-xs text-white outline-none"
              />
            </div>
          )}
        </div>

        {/* Appearance */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">Appearance</span>

          <div className="flex items-center gap-4">
            <ColorPicker color={element.style.stroke} onChange={(c) => handleStyleChange('stroke', c)} label="Stroke" />
            <ColorPicker color={element.style.fill} onChange={(c) => handleStyleChange('fill', c)} label="Fill" allowTransparent />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>Stroke Width</span><span>{element.style.strokeWidth}px</span>
            </div>
            <input
              type="range" min="1" max="20" step="1"
              value={element.style.strokeWidth}
              onChange={(e) => handleStyleChange('strokeWidth', parseInt(e.target.value))}
              className="accent-violet-500"
            />
          </div>

          <div className="flex flex-col gap-1">
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

          <div className="flex flex-col gap-1">
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

          {/* Stroke style */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-400">Stroke Style</span>
            <div className="flex gap-2">
              {(['solid', 'dashed', 'dotted'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => handleStyleChange('strokeStyle', s)}
                  className={`px-3 py-1 text-xs rounded border capitalize ${
                    element.style.strokeStyle === s
                      ? 'border-violet-500 text-violet-400 bg-violet-900/20'
                      : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Arrange */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">Arrange</span>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => bringToFront(element.id)} className="p-2 border border-zinc-800 rounded hover:bg-zinc-800 text-zinc-300" title="Bring to Front (Ctrl+])">
              <BringToFront size={16} />
            </button>
            <button onClick={() => bringForward(element.id)} className="p-2 border border-zinc-800 rounded hover:bg-zinc-800 text-zinc-300" title="Bring Forward">
              <ArrowUpToLine size={16} />
            </button>
            <button onClick={() => sendBackward(element.id)} className="p-2 border border-zinc-800 rounded hover:bg-zinc-800 text-zinc-300" title="Send Backward">
              <ArrowDownToLine size={16} />
            </button>
            <button onClick={() => sendToBack(element.id)} className="p-2 border border-zinc-800 rounded hover:bg-zinc-800 text-zinc-300" title="Send to Back (Ctrl+[)">
              <SendToBack size={16} />
            </button>
          </div>

          {/* Alignment - only when multiple selected */}
          {selectedIds.size > 1 && (
            <>
              <span className="text-[10px] text-zinc-400">Align</span>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => alignElements('left')} className="p-2 border border-zinc-800 rounded hover:bg-zinc-800 text-zinc-300" title="Align Left">
                  <AlignLeft size={16} />
                </button>
                <button onClick={() => alignElements('center-h')} className="p-2 border border-zinc-800 rounded hover:bg-zinc-800 text-zinc-300" title="Align Center">
                  <AlignCenter size={16} />
                </button>
                <button onClick={() => alignElements('right')} className="p-2 border border-zinc-800 rounded hover:bg-zinc-800 text-zinc-300" title="Align Right">
                  <AlignRight size={16} />
                </button>
                <button onClick={() => alignElements('top')} className="p-2 border border-zinc-800 rounded hover:bg-zinc-800 text-zinc-300" title="Align Top">
                  <AlignStartVertical size={16} />
                </button>
                <button onClick={() => alignElements('center-v')} className="p-2 border border-zinc-800 rounded hover:bg-zinc-800 text-zinc-300" title="Align Middle">
                  <AlignCenterVertical size={16} />
                </button>
                <button onClick={() => alignElements('bottom')} className="p-2 border border-zinc-800 rounded hover:bg-zinc-800 text-zinc-300" title="Align Bottom">
                  <AlignEndVertical size={16} />
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </motion.div>
  );
}
