import React from 'react';
import { Viewport, BoundingBox } from '@/types';
import { ResizeHandle, getResizeHandleCursor } from '@/lib/utils/transforms';

interface SelectionBoxProps {
  box: BoundingBox;
  viewport: Viewport;
  rotation?: number;
  onResizeStart: (e: React.PointerEvent<HTMLDivElement>, handle: ResizeHandle) => void;
  onRotateStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  isMultiple: boolean;
}

export function SelectionBox({ box, viewport, rotation = 0, onResizeStart, onRotateStart, isMultiple }: SelectionBoxProps) {
  // Convert world coordinates to screen coordinates
  const screenX = box.minX * viewport.zoom + viewport.x;
  const screenY = box.minY * viewport.zoom + viewport.y;
  const screenW = (box.maxX - box.minX) * viewport.zoom;
  const screenH = (box.maxY - box.minY) * viewport.zoom;

  const padding = 10; // fixed screen-pixel padding, don't multiply by zoom!
  
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${screenX - padding}px`,
    top: `${screenY - padding}px`,
    width: `${screenW + padding * 2}px`,
    height: `${screenH + padding * 2}px`,
    border: '2px solid var(--foreground)',
    pointerEvents: 'none',
    transform: `rotate(${rotation}rad)`,
    transformOrigin: 'center center'
  };

  const handleSize = 10;
  
  const createHandle = (handle: ResizeHandle, top: string, left: string) => {
    return (
      <div
        className="absolute bg-background border-2 border-foreground rounded-sm"
        style={{
          width: `${handleSize}px`,
          height: `${handleSize}px`,
          top,
          left,
          transform: 'translate(-50%, -50%)',
          cursor: getResizeHandleCursor(handle, rotation),
          pointerEvents: 'auto'
        }}
        onPointerDown={(e) => onResizeStart(e, handle)}
      />
    );
  };

  return (
    <div style={style}>
      {/* Rotation Handle */}
      {!isMultiple && (
        <>
          <div
            className="absolute bg-background border-2 border-foreground rounded-full"
            style={{
              width: `${handleSize}px`,
              height: `${handleSize}px`,
              top: '-30px',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              cursor: getResizeHandleCursor(ResizeHandle.ROTATION, rotation),
              pointerEvents: 'auto'
            }}
            onPointerDown={(e) => onRotateStart(e)}
          />
          {/* Connecting line to rotation handle */}
          <div 
            className="absolute border-l-2 border-foreground"
            style={{
              height: '30px',
              left: '50%',
              top: '-30px',
              transform: 'translateX(-50%)',
              zIndex: -1
            }}
          />
        </>
      )}

      {/* Resize Handles */}
      {createHandle(ResizeHandle.NW, '0%', '0%')}
      {createHandle(ResizeHandle.N, '0%', '50%')}
      {createHandle(ResizeHandle.NE, '0%', '100%')}
      {createHandle(ResizeHandle.E, '50%', '100%')}
      {createHandle(ResizeHandle.SE, '100%', '100%')}
      {createHandle(ResizeHandle.S, '100%', '50%')}
      {createHandle(ResizeHandle.SW, '100%', '0%')}
      {createHandle(ResizeHandle.W, '50%', '0%')}
    </div>
  );
}
