'use client';
import { useEffect, useState } from 'react';

interface PenCursorProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  activeTool: string;
  color: string;
  strokeSize: number;
}

export function PenCursor({ canvasRef, activeTool, color, strokeSize }: PenCursorProps) {
  const [cursor, setCursor] = useState<{ x: number; y: number; visible: boolean; pressure: number }>({
    x: 0, y: 0, visible: false, pressure: 0
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function onMove(e: PointerEvent) {
      if (e.pointerType !== 'pen') return;
      if (activeTool !== 'freehand' && activeTool !== 'eraser') return;
      const rect = canvas!.getBoundingClientRect();
      setCursor({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        visible: true,
        pressure: e.pressure,
      });
    }

    function onLeave(e: PointerEvent) {
      if (e.pointerType !== 'pen') return;
      setCursor(c => ({ ...c, visible: false }));
    }

    // These fire even before pencil touches screen (hover)
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, [canvasRef, activeTool]);

  if (!cursor.visible) return null;

  const size = Math.max(4, strokeSize * (cursor.pressure > 0 ? cursor.pressure * 2 : 1));

  return (
    <div
      className="pointer-events-none fixed z-50 rounded-full border-2 border-white mix-blend-difference transition-none"
      style={{
        left: cursor.x - size / 2,
        top: cursor.y - size / 2,
        width: size,
        height: size,
        backgroundColor: cursor.pressure > 0 ? color : 'transparent',
        transform: 'translate(0,0)', // force GPU layer
        willChange: 'left, top',
      }}
    />
  );
}
