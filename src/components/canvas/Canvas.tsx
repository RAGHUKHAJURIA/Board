'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useUIStore } from '@/store/ui-store';
import { renderCanvas } from '@/lib/canvas/renderer';
import { Point, ShapeType, WhiteboardElement, FreehandElement, ShapeElement, TextElement } from '@/types';
import { isPointInBox } from '@/lib/utils/geometry';
import { SelectionBox } from './SelectionBox';
import { ResizeHandle } from '@/lib/utils/transforms';
import { resizeElement as calcResizedBounds } from '@/lib/utils/transforms';
import { v4 as uuidv4 } from 'uuid';

type InteractionMode =
  | 'idle'
  | 'panning'
  | 'selecting'
  | 'drawing'
  | 'freehand'
  | 'dragging'
  | 'resizing'
  | 'rotating'
  | 'text-editing'
  | 'erasing';

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const elements = useCanvasStore(state => state.elements);
  const selectedIds = useCanvasStore(state => state.selectedIds);
  const viewport = useCanvasStore(state => state.viewport);
  const tool = useCanvasStore(state => state.tool);
  const { addElement, updateElement, deleteElements, selectElements, clearSelection, updateViewport, saveSnapshot, setTool, setIsInteracting, batchErase } = useCanvasStore();

  const currentStyle = useUIStore(state => state.currentStyle);
  const grid = useUIStore(state => state.grid);
  const eraserSettings = useUIStore(state => state.eraser);

  // Interaction state
  const modeRef = useRef<InteractionMode>('idle');
  const [mode, setModeState] = useState<InteractionMode>('idle');
  const setMode = (m: InteractionMode) => { modeRef.current = m; setModeState(m); };

  const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point } | null>(null);

  // Text editing
  const [textEditingId, setTextEditingId] = useState<string | null>(null);
  const [textEditorStyle, setTextEditorStyle] = useState<React.CSSProperties>({});
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const currentElementRef = useRef<WhiteboardElement | null>(null);
  const lastPointerPos = useRef<Point>({ x: 0, y: 0 }); // screen coords
  const dragStartElementPositions = useRef<Record<string, Point>>({});
  const resizeHandleRef = useRef<ResizeHandle | null>(null);
  const resizeStartBounds = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const resizeElementIdRef = useRef<string | null>(null);
  const rotateStartAngle = useRef<number>(0);
  const rotateCenter = useRef<Point>({ x: 0, y: 0 });
  const rotateElementIdRef = useRef<string | null>(null);

  // Handle resize setup
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

  // Main render loop
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

      // Draw rubber-band selection rectangle
      if (selectionBox && modeRef.current === 'selecting') {
        const ctx = canvasRef.current!.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.translate(viewport.x, viewport.y);
          ctx.scale(viewport.zoom, viewport.zoom);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
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
  }, [elements, selectedIds, viewport, grid, selectionBox]);

  // Screen → world
  const screenToWorld = (sx: number, sy: number): Point => ({
    x: (sx - viewport.x) / viewport.zoom,
    y: (sy - viewport.y) / viewport.zoom,
  });

  // Get all selected elements as array
  const getSelectedElements = () =>
    Array.from(selectedIds)
      .map(id => elements[id])
      .filter(Boolean) as WhiteboardElement[];

  // Batch erase: partial mode splits freehand strokes, deletes other elements touching the eraser circle.
  // We use getState() for reads and mutate everything in one deleteElements/addElement pass to avoid
  // polluting the undo history with dozens of intermediate snapshots.
  const performPartialErase = (world: Point, radius: number) => {
    const freshEls = useCanvasStore.getState().elements;
    const toDelete: string[] = [];
    const toAdd: WhiteboardElement[] = [];

    for (const el of Object.values(freshEls)) {
      if (el.type === ShapeType.FREEHAND) {
        const fh = el as FreehandElement;
        // Check if any SEGMENT of the stroke passes within eraser radius
        // (point-only check misses sparse strokes drawn quickly)
        let hit = false;
        for (let i = 0; i < fh.points.length; i++) {
          const [ax, ay] = fh.points[i]!;
          if (i < fh.points.length - 1) {
            const [bx, by] = fh.points[i + 1]!;
            const dx = bx - ax, dy = by - ay;
            const lenSq = dx * dx + dy * dy;
            let dist: number;
            if (lenSq === 0) {
              dist = Math.hypot(world.x - ax, world.y - ay);
            } else {
              const t = Math.max(0, Math.min(1, ((world.x - ax) * dx + (world.y - ay) * dy) / lenSq));
              dist = Math.hypot(world.x - (ax + t * dx), world.y - (ay + t * dy));
            }
            if (dist < radius) { hit = true; break; }
          } else {
            if (Math.hypot(world.x - ax, world.y - ay) < radius) { hit = true; break; }
          }
        }
        if (!hit) continue;

        // Split into surviving segments — erase points that are within radius of eraser
        const remaining: [number, number, number?][][] = [];
        let currentSegment: [number, number, number?][] = [];
        for (let si = 0; si < fh.points.length; si++) {
          const pt = fh.points[si]!;
          const [px, py] = pt;
          // Check point proximity
          let erased = Math.hypot(world.x - px, world.y - py) < radius;
          // Also erase if the segment FROM the previous point passes through the eraser
          if (!erased && si > 0) {
            const [ppx, ppy] = fh.points[si - 1]!;
            const dx2 = px - ppx, dy2 = py - ppy;
            const lenSq2 = dx2 * dx2 + dy2 * dy2;
            if (lenSq2 > 0) {
              const t2 = Math.max(0, Math.min(1, ((world.x - ppx) * dx2 + (world.y - ppy) * dy2) / lenSq2));
              const segDist = Math.hypot(world.x - (ppx + t2 * dx2), world.y - (ppy + t2 * dy2));
              if (segDist < radius) erased = true;
            }
          }
          if (erased) {
            if (currentSegment.length >= 2) remaining.push([...currentSegment]);
            currentSegment = [];
          } else {
            currentSegment.push(pt);
          }
        }
        if (currentSegment.length >= 2) remaining.push(currentSegment);

        toDelete.push(el.id);

        for (const segment of remaining) {
          const xs = segment.map(([x]) => x);
          const ys = segment.map(([, y]) => y);
          const newFh: FreehandElement = {
            id: uuidv4(),
            type: ShapeType.FREEHAND,
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys),
            rotation: fh.rotation,
            locked: false,
            zIndex: Date.now() + Math.random(),
            style: { ...fh.style },
            points: segment,
          };
          toAdd.push(newFh);
        }
      } else {
        // Non-freehand: bounding-box hit test
        const box = {
          minX: el.x - radius,
          minY: el.y - radius,
          maxX: el.x + el.width + radius,
          maxY: el.y + el.height + radius,
        };
        if (isPointInBox(world, box)) toDelete.push(el.id);
      }
    }

    if (toDelete.length === 0 && toAdd.length === 0) return;

    // Apply all changes without touching undo history (snapshot taken once at pointerdown)
    batchErase(toDelete, toAdd.length > 0 ? toAdd : undefined);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return; // ignore right-click

    // Close text editing
    if (textEditingId && modeRef.current === 'text-editing') {
      commitTextEdit();
    }

    (e.target as Element).setPointerCapture(e.pointerId);
    setIsInteracting(true);
    const screen: Point = { x: e.clientX, y: e.clientY };
    const world = screenToWorld(e.clientX, e.clientY);
    lastPointerPos.current = screen;

    // Middle button or hand tool → pan
    if (e.button === 1 || tool === 'hand') {
      setMode('panning');
      return;
    }

    // Text tool → click to create text element
    if (tool === 'text') {
      // Check if clicking on existing text element
      const sortedEls = Object.values(elements).sort((a, b) => b.zIndex - a.zIndex);
      let hitEl: WhiteboardElement | null = null;
      for (const el of sortedEls) {
        const box = { minX: el.x, minY: el.y, maxX: el.x + el.width, maxY: el.y + el.height };
        if (isPointInBox(world, box)) { hitEl = el; break; }
      }

      if (hitEl?.type === ShapeType.TEXT) {
        // Edit existing text
        selectElements([hitEl.id]);
        openTextEditor(hitEl as TextElement);
        return;
      }

      // Create new text element
      const id = uuidv4();
      const newText: TextElement = {
        id,
        type: ShapeType.TEXT,
        x: world.x,
        y: world.y,
        width: 200,
        height: 40,
        rotation: 0,
        locked: false,
        zIndex: Date.now(),
        style: { ...currentStyle },
        text: '',
        fontSize: 18,
        fontFamily: 'Inter, sans-serif',
        color: currentStyle.stroke,
      };
      addElement(newText);
      selectElements([id]);
      openTextEditor(newText);
      return;
    }

    // Eraser tool
    if (tool === 'eraser') {
      // Save ONE snapshot before the whole erase gesture (not per-element)
      saveSnapshot();
      const eraserRadius = eraserSettings.size / 2;

      if (eraserSettings.mode === 'object') {
        // Object mode: delete ALL elements under cursor in one pass
        const freshEls = useCanvasStore.getState().elements;
        const toDelete = Object.values(freshEls)
          .filter(el => isPointNearElement(world, el, eraserRadius))
          .map(el => el.id);
        if (toDelete.length > 0) {
          batchErase(toDelete);
        }
      } else {
        performPartialErase(world, eraserRadius);
      }
      setMode('erasing');
      return;
    }

    // Select tool
    if (tool === 'select') {
      const selectedArray = getSelectedElements();

      // Check resize handle first
      if (selectedArray.length >= 1) {
        const el = selectedArray[0]!;
        const handle = getHandleAtPoint(world, el, viewport.zoom);
        if (handle) {
          if (handle === ResizeHandle.ROTATION) {
            // Rotate
            const cx = el.x + el.width / 2;
            const cy = el.y + el.height / 2;
            rotateCenter.current = { x: cx, y: cy };
            rotateStartAngle.current = Math.atan2(world.y - cy, world.x - cx) - (el.rotation || 0);
            rotateElementIdRef.current = el.id;
            setMode('rotating');
          } else {
            // Resize
            resizeHandleRef.current = handle;
            resizeStartBounds.current = { x: el.x, y: el.y, width: el.width, height: el.height };
            resizeElementIdRef.current = el.id;
            setMode('resizing');
          }
          return;
        }
      }

      // Hit test elements
      const sortedEls = Object.values(elements).sort((a, b) => b.zIndex - a.zIndex);
      let hitId: string | null = null;
      for (const el of sortedEls) {
        const box = { minX: el.x, minY: el.y, maxX: el.x + el.width, maxY: el.y + el.height };
        if (isPointInBox(world, box)) { hitId = el.id; break; }
      }

      if (hitId) {
        if (e.shiftKey) {
          const newSet = new Set(selectedIds);
          if (newSet.has(hitId)) newSet.delete(hitId);
          else newSet.add(hitId);
          selectElements(Array.from(newSet));
        } else {
          if (!selectedIds.has(hitId)) selectElements([hitId]);
        }

        // Set up for drag-move
        const newSelected = e.shiftKey ? [] : [hitId];
        const toDrag = newSelected.length ? newSelected : Array.from(selectedIds.has(hitId) ? selectedIds : new Set([hitId]));
        dragStartElementPositions.current = {};
        toDrag.forEach(id => {
          const el = elements[id];
          if (el) dragStartElementPositions.current[id] = { x: el.x, y: el.y };
        });
        // Also include hitId if not in selection yet
        if (!dragStartElementPositions.current[hitId]) {
          const el = elements[hitId];
          if (el) dragStartElementPositions.current[hitId] = { x: el.x, y: el.y };
        }
        setMode('dragging');
      } else {
        clearSelection();
        setSelectionBox({ start: world, end: world });
        setMode('selecting');
      }
      return;
    }

    // Freehand drawing
    if (tool === ShapeType.FREEHAND) {
      const id = uuidv4();
      const newEl: FreehandElement = {
        id,
        type: ShapeType.FREEHAND,
        x: world.x,
        y: world.y,
        width: 0,
        height: 0,
        rotation: 0,
        locked: false,
        zIndex: Date.now(),
        style: { ...currentStyle },
        points: [[world.x, world.y, e.pressure > 0 ? e.pressure : 0.5]],
      };
      addElement(newEl);
      selectElements([id]);
      currentElementRef.current = newEl;
      setMode('freehand');
      return;
    }

    // Shape drawing
    const id = uuidv4();
    const shapeType = tool as Exclude<ShapeType, ShapeType.FREEHAND | ShapeType.TEXT | ShapeType.IMAGE | ShapeType.CONNECTOR>;
    const newShape: ShapeElement = {
      id,
      type: shapeType,
      x: world.x,
      y: world.y,
      width: 0,
      height: 0,
      rotation: 0,
      locked: false,
      zIndex: Date.now(),
      style: { ...currentStyle },
      seed: Math.floor(Math.random() * 100000),
    };
    addElement(newShape as unknown as WhiteboardElement);
    selectElements([id]);
    currentElementRef.current = newShape as unknown as WhiteboardElement;
    setMode('drawing');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const screen: Point = { x: e.clientX, y: e.clientY };
    const world = screenToWorld(e.clientX, e.clientY);
    const dx = screen.x - lastPointerPos.current.x;
    const dy = screen.y - lastPointerPos.current.y;

    switch (modeRef.current) {
      case 'panning': {
        const vp = useCanvasStore.getState().viewport;
        useCanvasStore.getState().updateViewport({ x: vp.x + dx, y: vp.y + dy });
        break;
      }

      case 'selecting': {
        if (selectionBox) {
          setSelectionBox(prev => prev ? { ...prev, end: world } : null);
          // Select elements within rubber band
          const minX = Math.min(selectionBox.start.x, world.x);
          const minY = Math.min(selectionBox.start.y, world.y);
          const maxX = Math.max(selectionBox.start.x, world.x);
          const maxY = Math.max(selectionBox.start.y, world.y);
          const inBox = Object.values(elements)
            .filter(el => el.x < maxX && el.x + el.width > minX && el.y < maxY && el.y + el.height > minY)
            .map(el => el.id);
          if (inBox.length > 0) selectElements(inBox);
          else clearSelection();
        }
        break;
      }

      case 'dragging': {
        const wdx = world.x - screenToWorld(lastPointerPos.current.x, lastPointerPos.current.y).x;
        const wdy = world.y - screenToWorld(lastPointerPos.current.x, lastPointerPos.current.y).y;
        // Move all selected elements
        const freshElements = useCanvasStore.getState().elements;
        Object.keys(dragStartElementPositions.current).forEach((id) => {
          const el = freshElements[id];
          if (el) updateElement(id, { x: el.x + wdx, y: el.y + wdy });
          // Keep our start positions in sync so we can call saveSnapshot later
          if (dragStartElementPositions.current[id]) {
            // no-op: we track start for the snapshot
          }
        });
        break;
      }

      case 'resizing': {
        const elId = resizeElementIdRef.current;
        const handle = resizeHandleRef.current;
        if (!elId || !handle) break;

        // Incremental world-space delta
        const prevWorld = screenToWorld(lastPointerPos.current.x, lastPointerPos.current.y);
        const wdx = world.x - prevWorld.x;
        const wdy = world.y - prevWorld.y;

        const el = useCanvasStore.getState().elements[elId];
        if (!el) break;

        const newBounds = calcResizedBounds(handle, el.x, el.y, el.width, el.height, wdx, wdy, e.shiftKey);
        updateElement(elId, newBounds);
        break;
      }


      case 'rotating': {
        const elId = rotateElementIdRef.current;
        if (!elId) break;
        const cx = rotateCenter.current.x;
        const cy = rotateCenter.current.y;
        const angle = Math.atan2(world.y - cy, world.x - cx);
        let rotation = angle - rotateStartAngle.current;
        // Snap to 15° increments if shift
        if (e.shiftKey) rotation = Math.round(rotation / (Math.PI / 12)) * (Math.PI / 12);
        updateElement(elId, { rotation });
        break;
      }

      case 'freehand': {
        if (!currentElementRef.current) break;
        const el = currentElementRef.current as FreehandElement;
        const pressure = e.pressure > 0 ? e.pressure : 0.5;
        const newPoint: [number, number, number] = [world.x, world.y, pressure];
        const existingPoints = el.points.map(
          ([x, y, p]) => [x, y, p ?? 0.5] as [number, number, number]
        );
        const newPoints = [...existingPoints, newPoint];
        updateElement(el.id, { points: newPoints });
        currentElementRef.current = { ...el, points: newPoints };
        break;
      }

      case 'drawing': {
        if (!currentElementRef.current) break;
        const el = currentElementRef.current;
        let width = world.x - el.x;
        let height = world.y - el.y;
        if (e.shiftKey) {
          const max = Math.max(Math.abs(width), Math.abs(height));
          width = width < 0 ? -max : max;
          height = height < 0 ? -max : max;
        }
        updateElement(el.id, { width, height });
        currentElementRef.current = { ...el, width, height };
        break;
      }

      case 'erasing': {
        const eraserRadius = eraserSettings.size / 2;
        if (eraserSettings.mode === 'object') {
          // Delete all elements under the moving eraser in one pass
          const freshEls = useCanvasStore.getState().elements;
          const toDelete = Object.values(freshEls)
            .filter(el => isPointNearElement(world, el, eraserRadius))
            .map(el => el.id);
          if (toDelete.length > 0) {
            batchErase(toDelete);
          }
        } else {
          performPartialErase(world, eraserRadius);
        }
        break;
      }

      default:
        break;
    }

    lastPointerPos.current = screen;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handlePointerUp = (_e: React.PointerEvent) => {
    const prevMode = modeRef.current;

    if (prevMode === 'selecting') {
      setSelectionBox(null);
    }
    
    if (prevMode === 'drawing' || prevMode === 'freehand') {
      const el = currentElementRef.current;
      // Remove zero-size elements (just a click)
      if (el && Math.abs(el.width) < 2 && Math.abs(el.height) < 2 && el.type !== ShapeType.FREEHAND) {
        deleteElements([el.id]);
        clearSelection();
      }
      // Save freehand to history
      if (el && el.type === ShapeType.FREEHAND) {
        const fh = el as FreehandElement;
        if (fh.points.length < 2) {
          deleteElements([el.id]);
          clearSelection();
        }
      }
      currentElementRef.current = null;
    }

    if (prevMode === 'dragging') {
      // Save snapshot after move
      saveSnapshot();
      dragStartElementPositions.current = {};
    }

    if (prevMode === 'resizing' || prevMode === 'rotating') {
      saveSnapshot();
      resizeHandleRef.current = null;
      resizeStartBounds.current = null;
      resizeElementIdRef.current = null;
      rotateElementIdRef.current = null;
    }

    if (prevMode === 'erasing') {
      // erasing already performed inline; nothing extra needed
    }

    setMode('idle');
    setIsInteracting(false);
  };

  // ── Wheel / Zoom handling ────────────────────────────────────────────────
  // Keep a ref so the non-passive callbacks always see the latest viewport
  // without needing to be recreated on every render.
  const viewportRef = useRef(viewport);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  // 1. GLOBAL guard: block browser page-zoom everywhere on the page.
  //    Without this, the browser zooms the entire page (sidebar, panels, etc.)
  useEffect(() => {
    const blockBrowserZoom = (e: WheelEvent) => {
      // Block Ctrl+scroll (browser zoom) and also plain scroll when over canvas
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    // Must be { passive: false } — passive listeners cannot call preventDefault()
    document.addEventListener('wheel', blockBrowserZoom, { passive: false });
    return () => document.removeEventListener('wheel', blockBrowserZoom);
  }, []);

  // 2. CANVAS-level handler: translates wheel events into viewport pan / zoom.
  //    Plain scroll = zoom (smooth, around cursor). Shift+scroll = pan.
  //    Ctrl+scroll / pinch = also zoom (trackpad). This keeps selection stable.
  const handleWheelNative = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const vp = useCanvasStore.getState().viewport;

    if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
      // Shift+scroll → horizontal pan
      updateViewport({ x: vp.x - e.deltaY, y: vp.y - e.deltaX });
    } else {
      // Default scroll / Ctrl+scroll / pinch → smooth zoom around cursor
      // Use a sensitivity that works well for both mice and trackpads.
      // Ctrl+scroll (trackpad pinch) sends small deltaY, plain mouse scroll
      // sends larger deltaY (typically ±100). Normalise both cases.
      const isTrackpadPinch = e.ctrlKey || e.metaKey;
      // Trackpads send smaller deltaY continuously, mice send large jumps (e.g. 100-120 per notch)
      const sensitivity = isTrackpadPinch ? 300 : 1000;
      const zoomFactor = Math.exp(-e.deltaY / sensitivity);
      const newZoom = Math.max(0.05, Math.min(vp.zoom * zoomFactor, 10));
      const scale = newZoom / vp.zoom;
      const newX = e.clientX - (e.clientX - vp.x) * scale;
      const newY = e.clientY - (e.clientY - vp.y) * scale;
      updateViewport({ zoom: newZoom, x: newX, y: newY });
    }
  }, [updateViewport]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', handleWheelNative);
  }, [handleWheelNative]);
  // ─────────────────────────────────────────────────────────────────────────

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (tool === 'select') {
      const world = screenToWorld(e.clientX, e.clientY);
      const sortedEls = Object.values(elements).sort((a, b) => b.zIndex - a.zIndex);
      for (const el of sortedEls) {
        const box = { minX: el.x, minY: el.y, maxX: el.x + el.width, maxY: el.y + el.height };
        if (isPointInBox(world, box) && el.type === ShapeType.TEXT) {
          selectElements([el.id]);
          openTextEditor(el as TextElement);
          return;
        }
      }
    }
  };

  // --- Text editing helpers ---
  const openTextEditor = (el: TextElement) => {
    setTextEditingId(el.id);
    setMode('text-editing');

    const screenX = el.x * viewport.zoom + viewport.x;
    const screenY = el.y * viewport.zoom + viewport.y;
    const screenW = Math.max(el.width * viewport.zoom, 100);
    const screenH = Math.max(el.height * viewport.zoom, 40);

    setTextEditorStyle({
      position: 'fixed',
      left: screenX,
      top: screenY,
      width: screenW,
      minHeight: screenH,
      fontSize: (el.fontSize || 18) * viewport.zoom,
      fontFamily: el.fontFamily || 'Inter, sans-serif',
      color: el.color || el.style.stroke,
      background: 'transparent',
      border: '2px solid var(--foreground)',
      outline: 'none',
      resize: 'none',
      padding: '4px',
      zIndex: 9999,
      borderRadius: '4px',
      lineHeight: 1.4,
    });

    setTimeout(() => {
      if (textAreaRef.current) {
        textAreaRef.current.value = el.type === ShapeType.TEXT ? el.text : '';
        textAreaRef.current.focus();
        textAreaRef.current.select();
      }
    }, 10);
  };

  const commitTextEdit = () => {
    if (!textEditingId || !textAreaRef.current) return;
    const text = textAreaRef.current.value;
    if (text.trim() === '') {
      deleteElements([textEditingId]);
    } else {
      updateElement(textEditingId, { text, width: Math.max(200, text.length * 10), height: 40 });
      saveSnapshot();
    }
    setTextEditingId(null);
    setMode('idle');
    setTool('select');
  };

  // --- Resize handle hit detection (for SelectionBox element) ---
  const getHandleAtPoint = (world: Point, el: WhiteboardElement, zoom: number): ResizeHandle | null => {
    const padding = 10 / zoom;
    const handleRadius = 8 / zoom;
    const minX = el.x - padding;
    const minY = el.y - padding;
    const maxX = el.x + el.width + padding;
    const maxY = el.y + el.height + padding;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const rotateY = minY - 30 / zoom;

    const handles: [ResizeHandle, Point][] = [
      [ResizeHandle.NW, { x: minX, y: minY }],
      [ResizeHandle.N, { x: midX, y: minY }],
      [ResizeHandle.NE, { x: maxX, y: minY }],
      [ResizeHandle.E, { x: maxX, y: midY }],
      [ResizeHandle.SE, { x: maxX, y: maxY }],
      [ResizeHandle.S, { x: midX, y: maxY }],
      [ResizeHandle.SW, { x: minX, y: maxY }],
      [ResizeHandle.W, { x: minX, y: midY }],
      [ResizeHandle.ROTATION, { x: midX, y: rotateY }],
    ];

    for (const [h, pos] of handles) {
      const dist = Math.hypot(world.x - pos.x, world.y - pos.y);
      if (dist < handleRadius) return h;
    }
    return null;
  };

  // Compute selection box data for the DOM overlay
  let activeSelectionBox = null as {
    box: { minX: number; minY: number; maxX: number; maxY: number };
    rotation: number;
    isMultiple: boolean;
  } | null;

  if (selectedIds.size > 0 && tool === 'select' && modeRef.current !== 'text-editing') {
    const selectedArray = Array.from(selectedIds).map(id => elements[id]).filter(Boolean) as WhiteboardElement[];
    if (selectedArray.length === 1) {
      const el = selectedArray[0]!;
      activeSelectionBox = {
        box: { minX: el.x, minY: el.y, maxX: el.x + el.width, maxY: el.y + el.height },
        rotation: el.rotation || 0,
        isMultiple: false,
      };
    } else if (selectedArray.length > 1) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      selectedArray.forEach(el => {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
      });
      activeSelectionBox = { box: { minX, minY, maxX, maxY }, rotation: 0, isMultiple: true };
    }
  }

  // Cursor
  const getCursor = () => {
    if (tool === 'hand' || mode === 'panning') return 'grabbing';
    if (tool === 'eraser') return 'none'; // we draw a custom cursor
    if (tool === 'text') return 'text';
    if (mode === 'dragging') return 'move';
    if (mode === 'resizing') return 'nwse-resize';
    if (mode === 'rotating') return 'grabbing';
    return 'crosshair';
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-background touch-none"
      style={{ cursor: getCursor(), overflow: 'hidden' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        className="absolute inset-0"
        style={{ touchAction: 'none' }}
      />

      {/* Selection box overlay */}
      {activeSelectionBox && (
        <SelectionBox
          box={activeSelectionBox.box}
          viewport={viewport}
          rotation={activeSelectionBox.rotation}
          isMultiple={activeSelectionBox.isMultiple}
          onResizeStart={(e, handle) => {
            e.stopPropagation();
            // Capture pointer on the container so move/up events keep firing
            // even if the pointer leaves the window during a drag.
            containerRef.current?.setPointerCapture(e.pointerId);
            const el = getSelectedElements()[0];
            if (!el) return;
            resizeHandleRef.current = handle;
            resizeStartBounds.current = { x: el.x, y: el.y, width: el.width, height: el.height };
            resizeElementIdRef.current = el.id;
            lastPointerPos.current = { x: e.clientX, y: e.clientY };
            setMode('resizing');
          }}
          onRotateStart={(e) => {
            e.stopPropagation();
            // Capture pointer on the container so move/up events keep firing
            containerRef.current?.setPointerCapture(e.pointerId);
            const world = screenToWorld(e.clientX, e.clientY);
            const el = getSelectedElements()[0];
            if (!el) return;
            const cx = el.x + el.width / 2;
            const cy = el.y + el.height / 2;
            rotateCenter.current = { x: cx, y: cy };
            rotateStartAngle.current = Math.atan2(world.y - cy, world.x - cx) - (el.rotation || 0);
            rotateElementIdRef.current = el.id;
            lastPointerPos.current = { x: e.clientX, y: e.clientY };
            setMode('rotating');
          }}
        />
      )}

      {/* Inline text editor */}
      {textEditingId && (
        <textarea
          ref={textAreaRef}
          style={textEditorStyle}
          onBlur={commitTextEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              commitTextEdit();
            }
            e.stopPropagation(); // Prevent keyboard shortcuts from firing
          }}
          placeholder="Type here..."
        />
      )}

      {/* Custom eraser cursor */}
      {tool === 'eraser' && (
        <EraserCursor size={eraserSettings.size} zoom={viewport.zoom} />
      )}
    </div>
  );
}

/* ─── Helper: Check if a point is near an element ─────────────────────────── */
/** Returns the minimum distance from point P to segment AB */
function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function isPointNearElement(world: Point, el: WhiteboardElement, radius: number): boolean {
  if (el.type === ShapeType.FREEHAND) {
    const fh = el as FreehandElement;
    if (fh.points.length === 0) return false;
    // Check each LINE SEGMENT between consecutive points, not just the points themselves.
    // This catches sparse strokes where the eraser passes between recorded points.
    for (let i = 0; i < fh.points.length; i++) {
      const [ax, ay] = fh.points[i]!;
      if (i === fh.points.length - 1) {
        // Last point: check point-to-point distance
        if (Math.hypot(world.x - ax, world.y - ay) < radius) return true;
      } else {
        const [bx, by] = fh.points[i + 1]!;
        if (pointToSegmentDist(world.x, world.y, ax, ay, bx, by) < radius) return true;
      }
    }
    return false;
  }
  // For shapes/text/images: expand bounding box by radius
  const box = {
    minX: el.x - radius,
    minY: el.y - radius,
    maxX: el.x + el.width + radius,
    maxY: el.y + el.height + radius,
  };
  return isPointInBox(world, box);
}

/* ─── Eraser Cursor Component ─────────────────────────────────────────────── */
function EraserCursor({ size, zoom }: { size: number; zoom: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleMove = (e: MouseEvent) => {
      const screenSize = size * zoom;
      el.style.transform = `translate(${e.clientX - screenSize / 2}px, ${e.clientY - screenSize / 2}px)`;
      el.style.opacity = '1';
    };
    const handleLeave = () => { el.style.opacity = '0'; };
    const handleEnter = () => { el.style.opacity = '1'; };

    // Use mousemove (fires without button press) instead of pointermove
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseleave', handleLeave);
    document.addEventListener('mouseenter', handleEnter);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseleave', handleLeave);
      document.removeEventListener('mouseenter', handleEnter);
    };
  }, [size, zoom]);

  const screenSize = size * zoom;
  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 pointer-events-none z-[9999]"
      style={{
        width: screenSize,
        height: screenSize,
        borderRadius: '50%',
        border: '2px solid rgba(0,0,0,0.5)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.5)',
        backgroundColor: 'rgba(128,128,128,0.1)',
        opacity: 0,
        willChange: 'transform',
        transition: 'width 0.15s, height 0.15s',
      }}
    />
  );
}
