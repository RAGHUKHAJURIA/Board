'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useCanvasStore } from '@/store/canvas-store';

function PenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
      <path d="m15 5 4 4"/>
    </svg>
  );
}

function HandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
    </svg>
  );
}

export function InputModeToggle() {
  const inputMode = useCanvasStore(s => s.inputMode);
  const setInputMode = useCanvasStore(s => s.setInputMode);

  if (!inputMode.isTouchDevice && !inputMode.isTablet) return null;

  const isPenMode = inputMode.mode === 'pen';

  return (
    <div
      className="fixed right-4 sm:right-6 z-[60] flex flex-col items-end sm:items-center gap-2"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))', touchAction: 'manipulation' }}
      onPointerDown={e => e.stopPropagation()}
      onPointerMove={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
      data-input-toggle
    >
      <AnimatePresence>
        <motion.div
          key={inputMode.mode}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
          className="
            px-2.5 py-1 rounded-lg text-xs font-medium
            bg-zinc-900/90 dark:bg-zinc-100/90 text-zinc-100 dark:text-zinc-900
            border border-zinc-700/50 dark:border-zinc-300/50
            backdrop-blur-sm shadow-lg
            whitespace-nowrap pointer-events-none
          "
        >
          {isPenMode ? 'Pen Mode — touch blocked' : 'Hand Mode — touch enabled'}
        </motion.div>
      </AnimatePresence>

      <div
        className="
          flex items-center gap-1 p-1
          bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800
          rounded-2xl shadow-xl
        "
      >
        <button
          onClick={() => setInputMode('pen')}
          className={`
            relative flex items-center justify-center
            w-10 h-10 sm:w-11 sm:h-11 rounded-xl
            transition-all duration-200 ease-out
            ${isPenMode
              ? 'text-white'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }
          `}
          aria-label="Switch to Pen Mode — blocks touch/palm input"
          title="Pen Mode"
        >
          <PenIcon />
          {isPenMode && (
            <motion.div
              layoutId="active-mode-indicator"
              className="absolute inset-0 rounded-xl bg-foreground -z-10"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
            />
          )}
        </button>

        <button
          onClick={() => setInputMode('hand')}
          className={`
            relative flex items-center justify-center
            w-10 h-10 sm:w-11 sm:h-11 rounded-xl
            transition-all duration-200 ease-out
            ${!isPenMode
              ? 'text-white'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }
          `}
          aria-label="Switch to Hand Mode — enables touch/finger input"
          title="Hand Mode"
        >
          <HandIcon />
          {!isPenMode && (
            <motion.div
              layoutId="active-mode-indicator"
              className="absolute inset-0 rounded-xl bg-foreground -z-10"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
            />
          )}
        </button>
      </div>
    </div>
  );
}
