import React, { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
  allowTransparent?: boolean;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', 
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef',
  '#f43f5e', '#1e293b', '#64748b', '#cbd5e1', '#ffffff'
];

export function ColorPicker({ color, onChange, label, allowTransparent }: ColorPickerProps) {
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
          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 p-3 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl flex flex-col gap-3 w-[220px]"
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
