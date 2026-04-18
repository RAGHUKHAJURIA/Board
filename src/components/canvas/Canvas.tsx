'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useHistoryStore } from '@/store/history-store';
import { useUIStore } from '@/store/ui-store';
import { renderCanvas } from '@/lib/canvas/renderer';
import { Point, ShapeType, WhiteboardElement, FreehandElement, ShapeElement } from '@/types';
import { isPointInBox } from '@/lib/utils/geometry';
import { SelectionBox } from './SelectionBox';
import { v4 as uuidv4 } from 'uuid';

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const elements = useCanvasStore(state => state.elements);
  const selectedIds = useCanvasStore(state => state.selectedIds);
  const viewport = useCanvasStore(state => state.viewport);
  const tool = useCanvasStore(state => state.tool);
  const { addElement, updateElement, selectElements, clearSelection, updateViewport } = useCanvasStore();
  
  const recordHistory = useHistoryStore(state => state.record);
  
  const currentStyle = useUIStore(state => state.currentStyle);
  const grid = useUIStore(state => state.grid);

  // Interaction State
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point } | null>(null);
  
  const currentElementRef = useRef<WhiteboardElement | null>(null);
  const lastMousePos = useRef<Point>({ x: 0, y: 0 });

  // Handle Resize setup
  const updateCanvasSize = useCallback(() => {
    if (canvasRef.current && containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvasRef.current.width = width * dpr;
      canvasRef.current.height = height * dpr;
      canvasRef.current.style.width = `${width}px`;
      canvasRef.current.style.height = `${height}px`;
      
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
      
      updateViewport({ width, height });
    }
  }, [updateViewport]);

  useEffect(() => {
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [updateCanvasSize]);

  // Main Render Loop
  useEffect(() => {
    if (!canvasRef.current) return;
    
    let frameId: number;
    const render = () => {
      renderCanvas(
        canvasRef.current!,
        Object.values(elements),
        selectedIds,
        viewport,
        grid
      );
      
      // Draw selection box if selecting
      if (selectionBox && isSelecting) {
        const ctx = canvasRef.current!.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.translate(viewport.x, viewport.y);
          ctx.scale(viewport.zoom, viewport.zoom);
          ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
          ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
          ctx.lineWidth = 1 / viewport.zoom;
          
          const x = Math.min(selectionBox.start.x, selectionBox.end.x);
          const y = Math.min(selectionBox.start.y, selectionBox.end.y);
          const w = Math.abs(selectionBox.end.x - selectionBox.start.x);
          const h = Math.abs(selectionBox.end.y - selectionBox.start.y);
          
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
          ctx.restore();
        }
      }
      
      frameId = requestAnimationFrame(render);
    };
    
    render();
    return () => cancelAnimationFrame(frameId);
  }, [elements, selectedIds, viewport, grid, selectionBox, isSelecting]);

  // Screen to World coordinates
  const getPointerPos = (e: React.PointerEvent): Point => {
    return {
      x: (e.clientX - viewport.x) / viewport.zoom,
      y: (e.clientY - viewport.y) / viewport.zoom
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const pos = getPointerPos(e);
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (e.button === 1 || tool === 'hand' || (e.button === 0 && e.buttons === 4 /* space pressed handled in shortcuts */)) {
      setIsPanning(true);
      return;
    }

    if (tool === 'select') {
      // Very basic hit detection
      let hitId: string | null = null;
      // Reverse iterate to find top-most element
      const sortedElements = Object.values(elements).sort((a, b) => b.zIndex - a.zIndex);
      
      for (const el of sortedElements) {
        const box = { minX: el.x, minY: el.y, maxX: el.x + el.width, maxY: el.y + el.height };
        if (isPointInBox(pos, box)) {
          hitId = el.id;
          break;
        }
      }

      if (hitId) {
        if (!e.shiftKey) {
          selectElements([hitId]);
        } else {
          const newSet = new Set(selectedIds);
          if (newSet.has(hitId)) newSet.delete(hitId);
          else newSet.add(hitId);
          selectElements(Array.from(newSet));
        }
        // TODO: Handle drag move
      } else {
        clearSelection();
        setIsSelecting(true);
        setSelectionBox({ start: pos, end: pos });
      }
      return;
    }

    // Creating new element
    setIsDrawing(true);
    
    const id = uuidv4();
    const newElement: Partial<WhiteboardElement> = {
      id,
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      rotation: 0,
      locked: false,
      zIndex: Date.now(), // quick simple z-index
      style: { ...currentStyle }
    };

    if (tool === ShapeType.FREEHAND) {
      newElement.type = ShapeType.FREEHAND;
      (newElement as FreehandElement).points = [[pos.x, pos.y, e.pressure]];
    } else {
      newElement.type = tool as ShapeType;
      (newElement as ShapeElement).seed = Math.floor(Math.random() * 100000);
    }

    currentElementRef.current = newElement as WhiteboardElement;
    addElement(newElement as WhiteboardElement);
    selectElements([id]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      updateViewport({ x: viewport.x + dx, y: viewport.y + dy });
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const pos = getPointerPos(e);

    if (isSelecting && selectionBox) {
      setSelectionBox({ ...selectionBox, end: pos });
      // TODO: Select elements within box
      return;
    }

    if (!isDrawing || !currentElementRef.current) return;

    const el = currentElementRef.current;
    
    if (el.type === ShapeType.FREEHAND) {
      const freehandEl = el as FreehandElement;
      const newPoints = [...freehandEl.points, [pos.x, pos.y, e.pressure] as [number, number, number]];
      updateElement(el.id, { points: newPoints });
      // Update local ref with new points to keep subsequent move events consistent
      currentElementRef.current = { ...freehandEl, points: newPoints };
    } else {
      let width = pos.x - el.x;
      let height = pos.y - el.y;

      if (e.shiftKey) {
        // Constrain proportions
        const max = Math.max(Math.abs(width), Math.abs(height));
        width = width < 0 ? -max : max;
        height = height < 0 ? -max : max;
      }

      updateElement(el.id, { width, height });
      currentElementRef.current = { ...el, width, height };
    }
  };

  const handlePointerUp = () => {
    if (isPanning) setIsPanning(false);
    if (isSelecting) {
      setIsSelecting(false);
      setSelectionBox(null);
    }
    
    if (isDrawing && currentElementRef.current) {
      setIsDrawing(false);
      // Record to history
      recordHistory({
        type: 'create',
        elements: [currentElementRef.current],
        timestamp: new Date().toISOString()
      });
      currentElementRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey) {
      // Zoom
      const zoomSensitivity = 0.001;
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      
      let newZoom = viewport.zoom - e.deltaY * zoomSensitivity;
      newZoom = Math.max(0.1, Math.min(newZoom, 10)); // Clamp

      // Adjust x and y to zoom into mouse point
      const scaleChange = newZoom - viewport.zoom;
      const newX = viewport.x - (mouseX - viewport.x) * (scaleChange / viewport.zoom);
      const newY = viewport.y - (mouseY - viewport.y) * (scaleChange / viewport.zoom);

      updateViewport({ zoom: newZoom, x: newX, y: newY });
    } else {
      // Pan
      updateViewport({
        x: viewport.x - e.deltaX,
        y: viewport.y - e.deltaY
      });
    }
  };

  // Derive selection box for currently selected elements
  let activeSelectionBox = null;
  if (selectedIds.size > 0 && tool === 'select') {
    const selectedArray = Array.from(selectedIds).map(id => elements[id]).filter(Boolean) as WhiteboardElement[];
    if (selectedArray.length === 1) {
      const el = selectedArray[0]!;
      activeSelectionBox = {
        box: { minX: el.x, minY: el.y, maxX: el.x + el.width, maxY: el.y + el.height },
        rotation: el.rotation,
        isMultiple: false
      };
    } else if (selectedArray.length > 1) {
      // Bounding box of multiple elements
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      selectedArray.forEach(el => {
        // Simplified, ignoring rotation bounds expansion for now
        minX = Math.min(minX, Math.min(el.x, el.x + el.width));
        minY = Math.min(minY, Math.min(el.y, el.y + el.height));
        maxX = Math.max(maxX, Math.max(el.x, el.x + el.width));
        maxY = Math.max(maxY, Math.max(el.y, el.y + el.height));
      });
      activeSelectionBox = {
        box: { minX, minY, maxX, maxY },
        rotation: 0,
        isMultiple: true
      };
    }
  }

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden bg-zinc-950 touch-none"
      onWheel={handleWheel}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="absolute inset-0 cursor-crosshair"
        style={{ touchAction: 'none' }}
      />
      
      {activeSelectionBox && (
        <SelectionBox
          box={activeSelectionBox.box}
          viewport={viewport}
          rotation={activeSelectionBox.rotation}
          isMultiple={activeSelectionBox.isMultiple}
          onResizeStart={() => {}} // TODO
          onRotateStart={() => {}} // TODO
        />
      )}
    </div>
  );
}
