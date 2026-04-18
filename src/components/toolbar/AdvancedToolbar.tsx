'use client';

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
} from 'lucide-react';
import { ShapeType } from '@/types';

export function AdvancedToolbar() {
  const { tool, setTool } = useCanvasStore();
  
  const tools = [
    { id: 'select', icon: MousePointer, label: 'Select (V)' },
    { id: 'hand', icon: Hand, label: 'Hand (H)' },
    { id: ShapeType.RECTANGLE, icon: Square, label: 'Rectangle (R)' },
    { id: ShapeType.CIRCLE, icon: Circle, label: 'Circle (O)' },
    { id: ShapeType.TRIANGLE, icon: Triangle, label: 'Triangle' },
    { id: ShapeType.DIAMOND, icon: Star, label: 'Diamond' },
    { id: ShapeType.HEXAGON, icon: Hexagon, label: 'Hexagon' },
    { id: ShapeType.LINE, icon: Minus, label: 'Line (L)' },
    { id: ShapeType.ARROW, icon: ArrowRight, label: 'Arrow (A)' },
    { id: ShapeType.FREEHAND, icon: Pencil, label: 'Pen (P)' },
    { id: ShapeType.TEXT, icon: Type, label: 'Text (T)' },
    { id: ShapeType.IMAGE, icon: ImageIcon, label: 'Image' },
    { id: 'eraser', icon: Eraser, label: 'Eraser (E)' },
  ];
  
  return (
    <div className="fixed top-16 left-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg p-2 flex flex-col gap-1 z-50">
      {tools.map((t) => {
        const Icon = t.icon;
        const isActive = tool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTool(t.id as import('@/types').Tool)}
            className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
              isActive ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : 'text-zinc-600 dark:text-zinc-400'
            }`}
            title={t.label}
          >
            <Icon size={20} />
          </button>
        );
      })}
    </div>
  );
}
