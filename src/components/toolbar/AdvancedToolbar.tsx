'use client';

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
} from 'lucide-react';
import { ShapeType } from '@/types';

export function AdvancedToolbar() {
  const { tool, setTool, undo, redo, canUndo, canRedo } = useCanvasStore();
  const currentStyle = useUIStore(state => state.currentStyle);
  const penType = currentStyle.penType || 'pen';
  const updateCurrentStyle = useUIStore(state => state.updateCurrentStyle);

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
      className="fixed top-0 bottom-0 my-auto left-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg p-2 flex flex-col gap-1 z-50 pointer-events-auto resize-y overflow-hidden outline-none min-h-[80px] max-h-[90vh] w-[50px]"
      style={{ height: '600px' }}
    >
      {/* Drag handle */}
      <div className="w-full flex justify-center py-1 mb-1 text-zinc-400 hover:text-zinc-200 cursor-grab active:cursor-grabbing shrink-0">
        <GripHorizontal size={16} />
      </div>

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

      {/* Scrollable tools list */}
      <div className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
      {tools.map((t, i) => {
        if (!t) {
          return <div key={i} className="w-full h-px bg-zinc-200 dark:bg-zinc-800 my-1" />;
        }
        const Icon = t.icon;
        const isActive = tool === t.id;
        if (t.id === ShapeType.FREEHAND) {
          return (
            <div key={t.id} className="relative group">
              <button
                onClick={() => setTool(t.id as import('@/types').Tool)}
                className={`w-full p-2 flex justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                  isActive ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <Icon size={20} />
              </button>
              
              {/* Flyout Menu for Pen Types */}
              <div className="absolute left-full ml-2 top-0 bg-zinc-900 text-white rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-200 delay-150 group-hover:delay-0 z-50 flex flex-col p-2 gap-1 border border-zinc-800 min-w-[140px] before:absolute before:content-[''] before:-left-2 before:top-0 before:w-2 before:h-full">
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
                        updateCurrentStyle({ stroke: c });
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
      </div>{/* end scrollable tools */}

      {/* Global Color - pinned at bottom */}
      <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800 my-1 shrink-0" />
      <div className="flex flex-col gap-2 items-center py-1 shrink-0">
        <ColorPicker 
          color={currentStyle.stroke} 
          onChange={(c) => updateCurrentStyle({ stroke: c })} 
          position="right"
        />
      </div>
    </motion.div>
  );
}
