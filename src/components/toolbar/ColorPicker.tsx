import React, { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
  allowTransparent?: boolean;
  position?: 'bottom' | 'right' | 'left' | 'top';
}

export const PRESET_COLORS = [
  // Grayscale
  '#ffffff', '#f8fafc', '#e2e8f0', '#94a3b8', '#64748b', '#334155', '#0f172a', '#000000',
  // Reds & Pinks
  '#fecdd3', '#fda4af', '#f43f5e', '#e11d48', '#be123c', '#fce7f3', '#f472b6', '#db2777',
  // Oranges & Yellows
  '#fed7aa', '#fb923c', '#ea580c', '#c2410c', '#fef08a', '#fde047', '#eab308', '#ca8a04',
  // Greens
  '#dcfce7', '#86efac', '#22c55e', '#16a34a', '#15803d', '#d9f99d', '#a3e635', '#65a30d',
  // Cyans & Blues
  '#cffafe', '#67e8f9', '#06b6d4', '#0891b2', '#bfdbfe', '#60a5fa', '#3b82f6', '#2563eb',
  // Purples
  '#e9d5ff', '#c084fc', '#a855f7', '#7e22ce', '#ede9fe', '#a78bfa', '#8b5cf6', '#6d28d9'
];

export function ColorPicker({ color, onChange, label, allowTransparent, position = 'bottom' }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const transparentSelected = color === 'transparent';

  return (
    <div className="relative flex flex-col items-center">
      {label && <span className="text-[10px] text-zinc-500 mb-1">{label}</span>}
      <button
        className="w-6 h-6 rounded-md shadow-sm border border-zinc-700 overflow-hidden relative cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        title="Choose color"
      >
        {transparentSelected ? (
          <div className="w-full h-full bg-white relative overflow-hidden">
             <div className="absolute w-[150%] h-[2px] bg-red-500 rotate-45 transform -translate-x-[20%] translate-y-3" />
          </div>
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: color }} />
        )}
      </button>

      {isOpen && (
        <div 
          ref={popoverRef}
          onPointerDownCapture={(e) => e.stopPropagation()}
          onPointerMoveCapture={(e) => e.stopPropagation()}
          className={`absolute z-50 p-3 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl flex flex-col gap-3 w-[220px] ${
            position === 'right' ? 'left-full ml-4 top-1/2 -translate-y-1/2' :
            position === 'left' ? 'right-full mr-4 top-1/2 -translate-y-1/2' :
            position === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' :
            'top-full mt-2 left-1/2 -translate-x-1/2' // default bottom
          }`}
        >
          {allowTransparent && (
            <button 
              className={`py-1 text-xs w-full rounded border ${transparentSelected ? 'border-violet-500 text-violet-500 bg-violet-500/10' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}
              onClick={() => { onChange('transparent'); setIsOpen(false); }}
            >
              Transparent
            </button>
          )}
          
          <HexColorPicker color={transparentSelected ? '#ffffff' : color} onChange={onChange} />
          
          <div className="flex flex-wrap gap-1.5 justify-center mt-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                className="w-5 h-5 rounded-md border border-zinc-700 hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
                onClick={() => onChange(c)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
