import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
  allowTransparent?: boolean;
  position?: 'bottom' | 'right' | 'left' | 'top';
  /** 'sm' = default small swatch button, 'lg' = bigger rounded button */
  size?: 'sm' | 'lg';
}

export const PRESET_COLORS = [
  // Row 1 – Whites & Grays
  '#ffffff', '#f8fafc', '#e2e8f0', '#94a3b8', '#64748b', '#334155',
  // Row 2 – Dark & Black
  '#0f172a', '#000000', '#fecdd3', '#fda4af', '#f43f5e', '#e11d48',
  // Row 3 – Pinks & Magentas
  '#be123c', '#fce7f3', '#f472b6', '#db2777', '#ec4899', '#fb923c',
  // Row 4 – Oranges & Yellows
  '#ea580c', '#c2410c', '#fed7aa', '#fef08a', '#fde047', '#eab308',
  // Row 5 – Greens
  '#ca8a04', '#dcfce7', '#86efac', '#22c55e', '#16a34a', '#15803d',
  // Row 6 – Limes & Teals
  '#d9f99d', '#a3e635', '#65a30d', '#cffafe', '#67e8f9', '#06b6d4',
  // Row 7 – Blues
  '#0891b2', '#bfdbfe', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8',
  // Row 8 – Purples
  '#e9d5ff', '#c084fc', '#a855f7', '#7e22ce', '#8b5cf6', '#6d28d9',
];

export function ColorPicker({ color, onChange, label, allowTransparent, position = 'bottom', size = 'sm' }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  // Compute popover position based on button location and the chosen direction
  const updatePopoverPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const gap = 12;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'right':
        // Anchor popup so its bottom aligns with the button's bottom
        // This makes the popup open upward when the button is near the screen bottom
        top = rect.bottom - 480; // approx popup height (~480px), will be clamped
        left = rect.right + gap;
        // Clamp so it doesn't go above the viewport
        if (top < 8) top = 8;
        break;
      case 'left':
        top = rect.bottom - 480;
        left = rect.left - gap - 240;
        if (top < 8) top = 8;
        break;
      case 'top':
        top = rect.top - gap;
        left = rect.left + rect.width / 2 - 120;
        break;
      default: // bottom
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - 120;
        break;
    }

    setPopoverPos({ top, left });
  }, [position]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Re-compute position when the popover opens or window resizes
  useEffect(() => {
    if (!isOpen) return;
    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    return () => window.removeEventListener('resize', updatePopoverPosition);
  }, [isOpen, updatePopoverPosition]);

  const transparentSelected = color === 'transparent';

  const isLg = size === 'lg';
  const btnClass = isLg
    ? 'w-8 h-8 rounded-xl shadow-md border-2 border-zinc-300 dark:border-zinc-300 dark:border-zinc-700 overflow-hidden relative cursor-pointer hover:scale-105 active:scale-95 transition-all'
    : 'w-6 h-6 rounded-md shadow-sm border border-zinc-300 dark:border-zinc-700 overflow-hidden relative cursor-pointer';

  // Determine swatch sizes based on context:
  // When opened from the sidebar (lg button), use smaller swatches to
  // keep the panel compact.  When opened from the properties panel (sm
  // button), use even smaller swatches since the panel is narrower.
  const swatchSize = isLg ? 'w-[28px] h-[28px]' : 'w-[22px] h-[22px]';
  const panelWidth = isLg ? 'w-[240px]' : 'w-[210px]';
  const pickerHeight = isLg ? 'h-[160px]' : 'h-[140px]';

  const popoverContent = (
    <div
      ref={popoverRef}
      onPointerDownCapture={(e) => e.stopPropagation()}
      onPointerMoveCapture={(e) => e.stopPropagation()}
      className={`fixed z-[9999] p-3 bg-white dark:bg-[#1a1a1e] border border-zinc-200 dark:border-zinc-700/60 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col gap-3 ${panelWidth}`}
      style={{
        top: position === 'top' ? undefined : popoverPos.top,
        bottom: position === 'top' ? `${window.innerHeight - popoverPos.top}px` : undefined,
        left: popoverPos.left,
      }}
    >
      {allowTransparent && (
        <button
          className={`py-1.5 text-xs w-full rounded-lg border ${transparentSelected ? 'border-foreground text-background bg-foreground' : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-200 dark:bg-zinc-800 transition-colors'}`}
          onClick={() => { onChange('transparent'); setIsOpen(false); }}
        >
          Transparent
        </button>
      )}

      {/* Saturation/Value + Hue picker */}
      <div className={`w-full ${pickerHeight} rounded-xl overflow-hidden [&_.react-colorful]:w-full [&_.react-colorful]:h-full [&_.react-colorful]:rounded-xl [&_.react-colorful__saturation]:rounded-t-xl [&_.react-colorful__last-control]:rounded-b-xl [&_.react-colorful__pointer]:w-5 [&_.react-colorful__pointer]:h-5 [&_.react-colorful__pointer]:border-[3px]`}>
        <HexColorPicker color={transparentSelected ? '#ffffff' : color} onChange={onChange} />
      </div>

      {/* Preset colors grid */}
      <div className="grid grid-cols-6 gap-[5px] justify-items-center pt-1">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            className={`${swatchSize} rounded-[8px] border ${
              color === c
                ? 'border-foreground ring-2 ring-foreground/30 scale-105'
                : 'border-zinc-300 dark:border-white/[0.06] hover:scale-110 hover:border-foreground/40'
            } active:scale-95 transition-all shadow-sm`}
            style={{ backgroundColor: c }}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="relative flex flex-col items-center" onPointerDown={(e) => e.stopPropagation()}>
      {label && <span className="text-[10px] text-zinc-500 mb-1">{label}</span>}
      <button
        ref={buttonRef}
        className={btnClass}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
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

      {isOpen && createPortal(popoverContent, document.body)}
    </div>
  );
}
