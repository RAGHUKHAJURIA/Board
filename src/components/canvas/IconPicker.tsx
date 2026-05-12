import React, { useState, useEffect, useMemo } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { Search, X } from 'lucide-react';
import { searchIcons } from '@/lib/icons/search';
import { ICON_CATEGORIES } from '@/lib/icons/registry';
import * as LucideIcons from 'lucide-react';

export function IconPicker() {
  const isOpen = useCanvasStore((state) => state.iconPickerOpen);
  const setOpen = useCanvasStore((state) => state.setIconPickerOpen);
  const addIconElement = useCanvasStore((state) => state.addIconElement);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCategory('All');
    }
  }, [isOpen]);

  const results = useMemo(() => searchIcons(query, category), [query, category]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div 
        className="w-full max-w-2xl h-[70vh] flex flex-col bg-slate-900/95 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center px-4 py-3 border-b border-slate-800">
          <div className="flex-1 flex items-center bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50 focus-within:border-blue-500/50 transition-colors">
            <Search className="w-5 h-5 text-slate-400 mr-2" />
            <input
              autoFocus
              type="text"
              placeholder="Search icons..."
              className="bg-transparent border-none outline-none text-slate-200 placeholder-slate-500 flex-1 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button 
            onClick={() => setOpen(false)}
            className="ml-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Categories */}
        <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto hide-scrollbar border-b border-slate-800/50">
          {ICON_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                category === cat 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                  : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {results.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500">
              <Search className="w-12 h-12 mb-4 opacity-20" />
              <p>No icons found for &quot;{query}&quot;</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {results.map((meta) => {
                const IconComponent = (LucideIcons as unknown as Record<string, React.ElementType>)[meta.name];
                if (!IconComponent) return null;

                return (
                  <button
                    key={meta.name}
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 hover:bg-slate-700 hover:border-slate-500/50 hover:scale-105 transition-all group"
                    onClick={() => addIconElement(meta.name, meta.library)}
                  >
                    <IconComponent className="w-8 h-8 text-slate-300 group-hover:text-white mb-2" strokeWidth={1.5} />
                    <span className="text-[10px] text-slate-500 group-hover:text-slate-300 truncate w-full text-center">
                      {meta.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
