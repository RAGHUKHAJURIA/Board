'use client';

import { motion } from 'framer-motion';
import { useCanvasStore } from '@/store/canvas-store';
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
} from 'lucide-react';
import { ShapeType } from '@/types';

export function AdvancedToolbar() {
  const { tool, setTool, undo, redo, canUndo, canRedo } = useCanvasStore();

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

  return (
    <motion.div 
      drag 
      dragMomentum={false}
      className="fixed top-0 bottom-0 my-auto h-fit left-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg p-2 flex flex-col gap-1 z-50 pointer-events-auto"
    >
      {/* Drag handle */}
      <div className="w-full flex justify-center py-1 mb-1 text-zinc-400 hover:text-zinc-200 cursor-grab active:cursor-grabbing">
        <GripHorizontal size={16} />
      </div>

      {/* Undo/Redo at top */}
      <button
        onClick={() => canUndo() && undo()}
        className={`p-2 rounded transition-colors ${canUndo() ? 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800' : 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'}`}
        title="Undo (Ctrl+Z)"
        disabled={!canUndo()}
      >
        <Undo2 size={20} />
      </button>
      <button
        onClick={() => canRedo() && redo()}
        className={`p-2 rounded transition-colors ${canRedo() ? 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800' : 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'}`}
        title="Redo (Ctrl+Y)"
        disabled={!canRedo()}
      >
        <Redo2 size={20} />
      </button>

      <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800 my-1" />

      {tools.map((t, i) => {
        if (!t) {
          return <div key={i} className="w-full h-px bg-zinc-200 dark:bg-zinc-800 my-1" />;
        }
        const Icon = t.icon;
        const isActive = tool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTool(t.id as import('@/types').Tool)}
            className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative group ${
              isActive ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : 'text-zinc-600 dark:text-zinc-400'
            }`}
            title={t.label}
          >
            <Icon size={20} />
            {/* Tooltip */}
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-zinc-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              {t.label}
            </div>
          </button>
        );
      })}
    </motion.div>
  );
}
