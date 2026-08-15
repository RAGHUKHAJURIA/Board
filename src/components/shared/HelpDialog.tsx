'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

/** Source of truth for what the app claims its shortcuts are. */
const SECTIONS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Tools',
    items: [
      ['Selection', 'V'],
      ['Hand (pan)', 'H'],
      ['Rectangle', 'R'],
      ['Ellipse', 'O'],
      ['Line', 'L'],
      ['Arrow', 'A'],
      ['Draw', 'P'],
      ['Text', 'T'],
      ['Eraser', 'E'],
      ['Laser pointer', 'K'],
    ],
  },
  {
    title: 'View',
    items: [
      ['Pan', 'Space + drag / middle-drag'],
      ['Zoom in / out', 'Ctrl + / Ctrl -'],
      ['Reset zoom', 'Ctrl 0'],
      ['Zoom to fit', 'Shift 1'],
      ['Toggle grid', "Ctrl '"],
    ],
  },
  {
    title: 'Editor',
    items: [
      ['Undo / Redo', 'Ctrl Z / Ctrl Shift Z'],
      ['Cut / Copy / Paste', 'Ctrl X / C / V'],
      ['Duplicate', 'Ctrl D  ·  Alt + drag'],
      ['Delete', 'Del'],
      ['Select all', 'Ctrl A'],
      ['Group / Ungroup', 'Ctrl G / Ctrl Shift G'],
      ['Lock / Unlock', 'Ctrl Shift L'],
      ['Copy / paste styles', 'Ctrl Alt C / Ctrl Alt V'],
      ['Flip horizontal / vertical', 'Shift H / Shift V'],
      ['Send to back / Bring to front', 'Ctrl [ / Ctrl ]'],
      ['Nudge / nudge far', 'Arrows / Shift Arrows'],
      ['Context menu', 'Right-click'],
    ],
  },
  {
    title: 'Export',
    items: [
      ['Open file', 'Ctrl O'],
      ['Save file', 'Ctrl S'],
      ['Export image', 'Ctrl Shift E'],
      ['This dialog', '?'],
    ],
  },
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1a1a1e] shadow-2xl p-5 text-foreground"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-foreground p-1 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                {section.title}
              </div>
              <div className="flex flex-col gap-1">
                {section.items.map(([label, keys]) => (
                  <div key={label} className="flex items-center justify-between gap-4 text-[13px]">
                    <span className="text-zinc-600 dark:text-zinc-300">{label}</span>
                    <span className="shrink-0 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/60 px-1.5 py-0.5 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                      {keys}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
