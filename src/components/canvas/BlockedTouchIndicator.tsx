'use client';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RipplePoint { id: number; x: number; y: number; }

export function useBlockedTouchFeedback() {
  const [ripples, setRipples] = useState<RipplePoint[]>([]);
  let counter = 0;

  const showBlockedFeedback = useCallback((clientX: number, clientY: number) => {
    const id = ++counter;
    setRipples(prev => [...prev, { id, x: clientX, y: clientY }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 600);
  }, []);

  const BlockedTouchIndicator = () => (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      <AnimatePresence>
        {ripples.map(r => (
          <motion.div
            key={r.id}
            initial={{ scale: 0.5, opacity: 0.7 }}
            animate={{ scale: 2.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute w-10 h-10 rounded-full border-2 border-foreground/50"
            style={{
              left: r.x - 20,
              top: r.y - 20,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );

  return { showBlockedFeedback, BlockedTouchIndicator };
}
