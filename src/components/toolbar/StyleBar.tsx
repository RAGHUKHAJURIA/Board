import React from 'react';
import { useUIStore } from '@/store/ui-store';
import { ColorPicker } from './ColorPicker';

export function StyleBar() {
  const currentStyle = useUIStore(state => state.currentStyle);
  const updateCurrentStyle = useUIStore(state => state.updateCurrentStyle);

  return (
    <div className="absolute top-full mt-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-xl shadow-lg flex items-center gap-4">
      <ColorPicker 
        color={currentStyle.stroke} 
        onChange={(c) => updateCurrentStyle({ stroke: c })} 
        label="Stroke" 
      />
      <ColorPicker 
        color={currentStyle.fill} 
        onChange={(c) => updateCurrentStyle({ fill: c })} 
        label="Fill" 
        allowTransparent
      />
      
      <div className="w-[1px] h-8 bg-zinc-200 dark:bg-zinc-800" />
      
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-500">Stroke Width</span>
        <div className="flex items-center gap-2">
          {[1, 2, 4].map(w => (
            <button
              key={w}
              className={`w-6 h-6 rounded flex items-center justify-center ${currentStyle.strokeWidth === w ? 'bg-foreground text-background' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-700'}`}
              onClick={() => updateCurrentStyle({ strokeWidth: w })}
            >
              <div className="bg-current rounded-full" style={{ width: w + 2, height: w + 2 }} />
            </button>
          ))}
        </div>
      </div>
      
      <div className="w-[1px] h-8 bg-zinc-200 dark:bg-zinc-800" />
      
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-500">Style</span>
        <div className="flex items-center gap-2">
          {(['solid', 'dashed', 'dotted'] as const).map(s => (
            <button
              key={s}
              className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono ${currentStyle.strokeStyle === s ? 'bg-foreground text-background' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-700'}`}
              onClick={() => updateCurrentStyle({ strokeStyle: s })}
            >
              {s === 'solid' ? '—' : s === 'dashed' ? '---' : '...'}
            </button>
          ))}
        </div>
      </div>
      
      <div className="w-[1px] h-8 bg-zinc-200 dark:bg-zinc-800" />
      
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-500">Roughness: {currentStyle.roughness}</span>
        <input 
          type="range" 
          min="0" max="3" step="0.5" 
          value={currentStyle.roughness}
          onChange={(e) => updateCurrentStyle({ roughness: parseFloat(e.target.value) })}
          className="w-20 accent-foreground"
        />
      </div>
    </div>
  );
}
