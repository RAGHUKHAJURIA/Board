'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCanvasStore } from '@/store/canvas-store';
import { useUIStore } from '@/store/ui-store';
import { ColorPicker, PRESET_COLORS } from './ColorPicker';
import {
  Square,
  Circle,
  Triangle,
  Minus,
  Type,
  Pencil,
  Eraser,
  Image as ImageIcon,
  MousePointer,
  Hand,
  ArrowRight,
  Star,
  Hexagon,
  Diamond,
  Undo2,
  Redo2,
  GripHorizontal,
  LayoutList,
  LayoutDashboard,
} from 'lucide-react';
import { ShapeType } from '@/types';

export function AdvancedToolbar() {
  const { tool, setTool, undo, redo, canUndo, canRedo, selectedIds, elements, updateElement } = useCanvasStore();
  const currentStyle = useUIStore(state => state.currentStyle);
  const penType = currentStyle.penType || 'pen';
  const updateCurrentStyle = useUIStore(state => state.updateCurrentStyle);
  const eraserSettings = useUIStore(state => state.eraser);
  const updateEraser = useUIStore(state => state.updateEraser);

  // Orientation: 'vertical' (default tall sidebar) | 'horizontal' (bottom/top bar)
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');

  const handleColorChange = (c: string) => {
    updateCurrentStyle({ stroke: c });
    if (selectedIds.size > 0) {
      selectedIds.forEach((id) => {
        const el = elements[id];
        if (el) {
          updateElement(id, {
            style: { ...el.style, stroke: c }
          });
        }
      });
    }
  };

  const tools = [
    { id: 'select', icon: MousePointer, label: 'Select (V)' },
    { id: 'hand', icon: Hand, label: 'Hand (H)' },
    null, // separator
    { id: ShapeType.RECTANGLE, icon: Square, label: 'Rectangle (R)' },
    { id: ShapeType.CIRCLE, icon: Circle, label: 'Circle (O)' },
    { id: ShapeType.TRIANGLE, icon: Triangle, label: 'Triangle' },
    { id: ShapeType.DIAMOND, icon: Diamond, label: 'Diamond' },
    { id: ShapeType.STAR, icon: Star, label: 'Star' },
    { id: ShapeType.HEXAGON, icon: Hexagon, label: 'Hexagon' },
    null, // separator
    { id: ShapeType.LINE, icon: Minus, label: 'Line (L)' },
    { id: ShapeType.ARROW, icon: ArrowRight, label: 'Arrow (A)' },
    null, // separator
    { id: ShapeType.FREEHAND, icon: Pencil, label: 'Pen (P)' },
    { id: ShapeType.TEXT, icon: Type, label: 'Text (T)' },
    { id: ShapeType.IMAGE, icon: ImageIcon, label: 'Image' },
    { id: 'eraser', icon: Eraser, label: 'Eraser (E)' },
  ];

  const isVertical = orientation === 'vertical';

  /* ── Shared button renderer ───────────────────────────────── */
  const renderToolButton = (t: { id: string; icon: React.ElementType; label: string } | null, i: number) => {
    if (!t) {
      return isVertical
        ? <div key={i} className="w-full h-px bg-zinc-200 dark:bg-zinc-800 my-1 shrink-0" />
        : <div key={i} className="h-full w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />;
    }

    const Icon = t.icon;
    const isActive = tool === t.id;

    if (t.id === ShapeType.FREEHAND) {
      return (
        <div key={t.id} className="relative group shrink-0">
          <button
            onClick={() => setTool(t.id as import('@/types').Tool)}
            className={`p-2 flex justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
              isActive ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <Icon size={20} />
          </button>

          {/* Flyout Menu for Pen Types */}
          <div className={`absolute ${isVertical ? 'left-full ml-2 top-0' : 'bottom-full mb-2 left-0'} bg-zinc-900 text-white rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-200 delay-150 group-hover:delay-0 z-50 flex flex-col p-2 gap-1 border border-zinc-800 min-w-[140px] ${isVertical ? 'before:absolute before:content-[\'\'] before:-left-2 before:top-0 before:w-2 before:h-full' : ''}`}>
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 px-2">Pen Type</div>
            {(['pen', 'pencil', 'fountain', 'marker', 'highlighter'] as const).map(pt => (
              <button
                key={pt}
                onClick={(e) => {
                   e.stopPropagation();
                   updateCurrentStyle({ penType: pt });
                   setTool(ShapeType.FREEHAND);
                }}
                className={`text-left text-xs px-2 py-1.5 rounded capitalize hover:bg-zinc-800 transition-colors ${
                  penType === pt 
                    ? 'text-violet-400 bg-violet-900/20 font-medium' 
                    : 'text-zinc-300'
                }`}
              >
                {pt}
              </button>
            ))}
            
            <div className="w-full h-px bg-zinc-800 my-1" />
            
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 px-2 mt-1">Color</div>
            <div className="flex flex-wrap gap-1 px-1 pb-1 justify-center max-w-[160px]">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  className={`w-4 h-4 rounded-sm border ${currentStyle.stroke === c ? 'border-white scale-110 relative z-10 shadow-[0_0_0_2px_rgba(139,92,246,0.8)]' : 'border-zinc-700 hover:scale-110'} transition-all`}
                  style={{ backgroundColor: c }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleColorChange(c);
                    setTool(ShapeType.FREEHAND);
                  }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Eraser tool — simple button (options panel shows when active)
    if (t.id === 'eraser') {
      return (
        <button
          key={t.id}
          onClick={() => setTool('eraser')}
          className={`p-2 flex justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative group shrink-0 ${
            isActive ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : 'text-zinc-600 dark:text-zinc-400'
          }`}
          title={t.label}
        >
          <Icon size={20} />
          {/* Tooltip */}
          <div className={`absolute ${isVertical ? 'left-full ml-2 top-1/2 -translate-y-1/2' : 'bottom-full mb-2 left-1/2 -translate-x-1/2'} bg-zinc-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50`}>
            {t.label}
          </div>
        </button>
      );
    }

    return (
      <button
        key={t.id}
        onClick={() => setTool(t.id as import('@/types').Tool)}
        className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative group shrink-0 ${
          isActive ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : 'text-zinc-600 dark:text-zinc-400'
        }`}
        title={t.label}
      >
        <Icon size={20} />
        {/* Tooltip */}
        <div className={`absolute ${isVertical ? 'left-full ml-2 top-1/2 -translate-y-1/2' : 'bottom-full mb-2 left-1/2 -translate-x-1/2'} bg-zinc-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50`}>
          {t.label}
        </div>
      </button>
    );
  };

  /* ── Vertical layout ──────────────────────────────────────── */
  if (isVertical) {
    return (
      <>
      <motion.div
        key="vertical-toolbar"
        drag
        dragMomentum={false}
        className="fixed top-0 bottom-0 my-auto left-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg p-2 flex flex-col gap-1 z-50 pointer-events-auto outline-none min-h-[80px] max-h-[90vh]"
        style={{ height: '600px', width: '50px' }}
      >
        {/* Drag handle */}
        <div className="w-full flex justify-center py-1 mb-1 text-zinc-400 hover:text-zinc-200 cursor-grab active:cursor-grabbing shrink-0">
          <GripHorizontal size={16} />
        </div>

        {/* Orientation toggle */}
        <button
          onClick={() => setOrientation('horizontal')}
          className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400 dark:text-zinc-500 shrink-0 relative group flex justify-center"
          title="Switch to horizontal toolbar"
        >
          <LayoutDashboard size={16} />
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-zinc-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            Horizontal mode
          </div>
        </button>

        {/* Undo/Redo at top - pinned */}
        <button
          onClick={() => canUndo() && undo()}
          className={`p-2 rounded transition-colors shrink-0 ${canUndo() ? 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800' : 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'}`}
          title="Undo (Ctrl+Z)"
          disabled={!canUndo()}
        >
          <Undo2 size={20} />
        </button>
        <button
          onClick={() => canRedo() && redo()}
          className={`p-2 rounded transition-colors shrink-0 ${canRedo() ? 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800' : 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'}`}
          title="Redo (Ctrl+Y)"
          disabled={!canRedo()}
        >
          <Redo2 size={20} />
        </button>

        <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800 my-1 shrink-0" />

        {/* Scrollable tools list — invisible scrollbar so it never overlaps icons */}
        <div
          className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {tools.map((t, i) => renderToolButton(t, i))}
        </div>

        {/* Global Color - pinned at bottom */}
        <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800 my-1 shrink-0" />
        <div className="flex flex-col items-center py-1 shrink-0">
          <ColorPicker 
            color={currentStyle.stroke} 
            onChange={handleColorChange} 
            position="right"
            size="lg"
          />
        </div>
      </motion.div>

      {/* Eraser Options Panel — shows when eraser tool is active */}
      {tool === 'eraser' && (
        <div
          className="fixed left-[76px] top-1/2 -translate-y-1/2 bg-zinc-900/95 backdrop-blur-md text-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex flex-col p-3 gap-2 border border-zinc-800 w-[180px] z-50 pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1">Eraser Mode</div>
          <button
            onClick={() => updateEraser({ mode: 'object' })}
            className={`text-left text-xs px-3 py-2 rounded-lg transition-colors ${
              eraserSettings.mode === 'object'
                ? 'text-violet-400 bg-violet-500/15 font-medium border border-violet-500/30'
                : 'text-zinc-300 hover:bg-zinc-800 border border-transparent'
            }`}
          >
            <div className="font-medium">🧹 Object</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Remove whole element</div>
          </button>
          <button
            onClick={() => updateEraser({ mode: 'partial' })}
            className={`text-left text-xs px-3 py-2 rounded-lg transition-colors ${
              eraserSettings.mode === 'partial'
                ? 'text-violet-400 bg-violet-500/15 font-medium border border-violet-500/30'
                : 'text-zinc-300 hover:bg-zinc-800 border border-transparent'
            }`}
          >
            <div className="font-medium">✂️ Partial</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Erase where you drag</div>
          </button>

          <div className="w-full h-px bg-zinc-800 my-1" />

          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1">Size</div>
          <div className="flex flex-col gap-1.5 px-1">
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>Radius</span>
              <span>{eraserSettings.size}px</span>
            </div>
            <input
              type="range"
              min="5"
              max="80"
              step="5"
              value={eraserSettings.size}
              onChange={(e) => updateEraser({ size: parseInt(e.target.value) })}
              className="accent-violet-500 w-full"
            />
            <div className="flex gap-1">
              {[10, 20, 40, 60].map(sz => (
                <button
                  key={sz}
                  onClick={() => updateEraser({ size: sz })}
                  className={`flex-1 text-[10px] py-1 rounded border transition-colors ${
                    eraserSettings.size === sz
                      ? 'border-violet-500 text-violet-400 bg-violet-500/15'
                      : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
    );
  }

  /* ── Horizontal layout ────────────────────────────────────── */
  return (
    <motion.div
      key="horizontal-toolbar"
      drag
      dragMomentum={false}
      className="fixed bottom-6 left-0 right-0 mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg px-3 py-2 flex flex-row items-center gap-1 z-50 pointer-events-auto outline-none max-w-max"
      style={{ width: 'max-content', overflow: 'hidden' }}
    >
      {/* Drag handle */}
      <div className="flex items-center pr-1 text-zinc-400 hover:text-zinc-200 cursor-grab active:cursor-grabbing shrink-0">
        <GripHorizontal size={16} />
      </div>

      <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

      {/* Orientation toggle */}
      <button
        onClick={() => setOrientation('vertical')}
        className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400 dark:text-zinc-500 shrink-0 relative group"
        title="Switch to vertical toolbar"
      >
        <LayoutList size={16} />
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          Vertical mode
        </div>
      </button>

      <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

      {/* Undo/Redo */}
      <button
        onClick={() => canUndo() && undo()}
        className={`p-2 rounded transition-colors shrink-0 ${canUndo() ? 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800' : 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'}`}
        title="Undo (Ctrl+Z)"
        disabled={!canUndo()}
      >
        <Undo2 size={18} />
      </button>
      <button
        onClick={() => canRedo() && redo()}
        className={`p-2 rounded transition-colors shrink-0 ${canRedo() ? 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800' : 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'}`}
        title="Redo (Ctrl+Y)"
        disabled={!canRedo()}
      >
        <Redo2 size={18} />
      </button>

      <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

      {/* Tools — horizontal row, no scrollbar */}
      <div className="flex flex-row items-center gap-1 overflow-x-hidden overflow-y-hidden">
        {tools.map((t, i) => renderToolButton(t, i))}
      </div>

      <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

      {/* Global Color */}
      <div className="flex items-center px-1 shrink-0">
        <ColorPicker 
          color={currentStyle.stroke} 
          onChange={handleColorChange} 
          position="top"
          size="lg"
        />
      </div>
    </motion.div>
  );
}
