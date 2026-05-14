'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useUIStore } from '@/store/ui-store';
import { renderCanvas } from '@/lib/canvas/renderer';
import { Point, ShapeType, WhiteboardElement, FreehandElement, ShapeElement, TextElement, ConnectorElement, ImageElement } from '@/types';
import { isPointInBox } from '@/lib/utils/geometry';
import { SelectionBox } from './SelectionBox';
import { IconPicker } from './IconPicker';
import { ResizeHandle } from '@/lib/utils/transforms';
import { resizeElement as calcResizedBounds } from '@/lib/utils/transforms';
import { v4 as uuidv4 } from 'uuid';
import { SpatialIndex } from '@/lib/canvas/spatial-index';
import { ImageHandler } from '@/lib/canvas/image-handler';
import { EraserManager } from '@/lib/canvas/eraser-manager';
import { ConnectorManager } from '@/lib/canvas/connectors';
import { debounce } from '@/lib/utils/debounce';
import { getElementsInSelectionBox } from '@/lib/canvas/hit-test';
import { hitTestPoint, hitTestConnectorHandles } from '@/lib/canvas/hit-testing';
import { extractRawCoalescedPoints } from '@/lib/input/pointer-utils';
import { gestureHandler } from '@/lib/input/gesture-handler';
import { gatePointerEvent } from '@/lib/input/input-gate';
import { getDeviceCapabilities } from '@/lib/input/device-detection';
import { createActiveStroke, clearStrokeTimeout, type ActiveStroke, type CompletionReason } from '@/lib/canvas/stroke-state';
import { PenCursor } from './PenCursor';

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
  | 'erasing'
  | 'connector-draw'
  | 'connector-reshaping'
  | 'connector-endpoint-drag';


export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const elements = useCanvasStore(state => state.elements);
  const selectedIds = useCanvasStore(state => state.selectedIds);
  const viewport = useCanvasStore(state => state.viewport);
  const tool = useCanvasStore(state => state.tool);
  const canvasBackground = useCanvasStore(state => state.canvasBackground);
  const inputMode = useCanvasStore(state => state.inputMode);
  const { addElement, updateElement, deleteElements, selectElements, clearSelection, updateViewport, saveSnapshot, setTool, setIsInteracting, batchErase } = useCanvasStore();

  const currentStyle = useUIStore(state => state.currentStyle);
  const grid = useUIStore(state => state.grid);
  const theme = useUIStore(state => state.theme);

  const resolvedTheme: 'light' | 'dark' = theme === 'system'
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  const eraserSettings = useCanvasStore(state => state.eraserSettings);
  const setInputState = useCanvasStore(state => state.setInputState);

  // Tablet / iPad pointers
  const rejectedPointers = useRef(new Set<number>());

  // Interaction state
  const modeRef = useRef<InteractionMode>('idle');
  const [mode, setModeState] = useState<InteractionMode>('idle');
  const setMode = useCallback((m: InteractionMode) => { modeRef.current = m; setModeState(m); }, []);

  const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point } | null>(null);

  // Text editing
  const [textEditingId, setTextEditingId] = useState<string | null>(null);
  const [textEditorStyle, setTextEditorStyle] = useState<React.CSSProperties>({});
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Image Upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentElementRef = useRef<WhiteboardElement | null>(null);
  const lastPointerPos = useRef<Point>({ x: 0, y: 0 }); // screen coords
  const lastPointerWorldPos = useRef<Point | null>(null); // world coords for sweep testing
  const spatialIndexRef = useRef<SpatialIndex>(new SpatialIndex());
  const eraserRef = useRef<EraserManager | null>(null);
  const dragStartElementPositions = useRef<Record<string, Point>>({});
  const resizeHandleRef = useRef<ResizeHandle | null>(null);
  const resizeStartBounds = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const resizeGroupStartBounds = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const activeGroupBounds = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const resizeElementStartBoundsRef = useRef<Record<string, { x: number; y: number; width: number; height: number; type: string; controlPoints?: { x: number; y: number }[] }>>({});
  const resizeElementIdRef = useRef<string | null>(null);
  const rotateStartAngle = useRef<number>(0);
  const rotateCenter = useRef<Point>({ x: 0, y: 0 });
  const rotateElementIdRef = useRef<string | null>(null);
  const connectorHandleIndexRef = useRef<number | null>(null);
  const connectorEndpointRef = useRef<'start' | 'end' | null>(null);

  // ── Native freehand stroke tracking (bypasses React synthetic events) ──
  const activeStrokeRef = useRef<ActiveStroke | null>(null);
  // Minimum distance between points (world units) to prevent jitter
  const MIN_POINT_DISTANCE = 0.5;

  // Initialize EraserManager
  useEffect(() => {
    eraserRef.current = new EraserManager(spatialIndexRef.current);
  }, []);

  // Initialize device capabilities for input mode
  useEffect(() => {
    const caps = getDeviceCapabilities();

    let savedMode: 'pen' | 'hand' = 'hand';
    try {
      const stored = localStorage.getItem('drawer_input_mode');
      if (stored === 'pen' || stored === 'hand') savedMode = stored;
    } catch {}

    if (caps.isTablet && !localStorage.getItem('drawer_input_mode')) {
      savedMode = 'pen';
    }

    useCanvasStore.setState(state => {
      state.inputMode.isTouchDevice = caps.isTouchCapable;
      state.inputMode.isTablet = caps.isTablet || caps.isMobile;
      state.inputMode.mode = savedMode;
    });
  }, []);

  // ── Finalize stroke helper ──────────────────────────────────────────────
  // All completion paths (pointerup, pointercancel, lostpointercapture,
  // timeout, force-complete) funnel through this single function.
  const finalizeActiveStroke = useCallback((
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _reason: CompletionReason
  ) => {
    const stroke = activeStrokeRef.current;
    if (!stroke) return;

    clearStrokeTimeout(stroke);
    stroke.phase = 'completing';

    const store = useCanvasStore.getState();
    const el = store.elements[stroke.elementId];

    if (el && el.type === ShapeType.FREEHAND) {
      if (stroke.points.length < 2) {
        // Single-point tap — too small to keep
        store.deleteElements([stroke.elementId]);
        store.clearSelection();
      } else {
        // Commit final points to the store
        store.updateElement(stroke.elementId, {
          points: [...stroke.points],
        });
        store.saveSnapshot();
      }
    }

    activeStrokeRef.current = null;
    if (modeRef.current === 'freehand') {
      currentElementRef.current = null;
      setMode('idle');
      setIsInteracting(false);
    }
  }, [setIsInteracting, setMode]);

  // ── Native freehand pointer listeners (bypass React synthetic events) ──
  // React's synthetic event system processes one event per render cycle and
  // does NOT expose getCoalescedEvents(). Attaching raw native listeners
  // directly to the canvas DOM node fixes stroke skipping on iPad.
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current; // TS narrows: HTMLCanvasElement

    function handleNativeFreehandDown(e: PointerEvent) {
      const store = useCanvasStore.getState();
      const currentTool = store.tool;
      if (currentTool !== ShapeType.FREEHAND) return;

      // Only intercept pen/touch events that would draw freehand
      // Let the React handler manage everything else
      const im = store.inputMode;
      const decision = gatePointerEvent(e, im.mode, im.isTouchDevice);
      if (decision !== 'allow') return;

      // Don't intercept right-click or if already in a non-idle/non-freehand mode
      if (e.button === 2) return;
      const currentMode = modeRef.current;
      if (currentMode !== 'idle' && currentMode !== 'freehand') return;

      // CRITICAL: preventDefault stops iOS Scribble from intercepting pen events
      if (e.pointerType === 'pen') {
        e.preventDefault();
      }

      // If a stroke is already open (e.g. missed pointerup), finalize it
      if (activeStrokeRef.current) {
        finalizeActiveStroke('force-complete');
      }

      // Capture the pointer so move/up fire on canvas even if pointer leaves bounds
      try { canvas.setPointerCapture(e.pointerId); } catch {}

      const vp = store.viewport;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldX = (screenX - vp.x) / vp.zoom;
      const worldY = (screenY - vp.y) / vp.zoom;
      const pressure = e.pressure > 0 ? Math.max(0.1, e.pressure) : 0.5;

      // Create the freehand element in the store
      const id = uuidv4();
      const newEl: FreehandElement = {
        id,
        type: ShapeType.FREEHAND,
        x: worldX,
        y: worldY,
        width: 0,
        height: 0,
        rotation: 0,
        locked: false,
        zIndex: Date.now(),
        style: { ...useUIStore.getState().currentStyle },
        points: [[worldX, worldY, pressure]],
        simulatePressure: e.pointerType !== 'pen',
      };
      store.addElement(newEl);
      store.selectElements([id]);
      currentElementRef.current = newEl;
      setMode('freehand');
      setIsInteracting(true);

      // Create active stroke tracking
      const stroke = createActiveStroke(e.pointerId, e.pointerType, id, worldX, worldY, pressure);
      activeStrokeRef.current = stroke;

      // Safety timeout: if pen-up never fires within 10s, auto-complete
      stroke.timeoutHandle = setTimeout(() => {
        if (activeStrokeRef.current?.pointerId === e.pointerId) {
          console.warn('[Drawer] Pen-up safety timeout — force completing stroke');
          finalizeActiveStroke('timeout');
        }
      }, 10_000);
    }

    function handleNativeFreehandMove(e: PointerEvent) {
      const stroke = activeStrokeRef.current;
      if (!stroke || stroke.pointerId !== e.pointerId) return;
      if (stroke.phase !== 'drawing' && stroke.phase !== 'pen-down') return;

      const store = useCanvasStore.getState();
      const im = store.inputMode;
      const decision = gatePointerEvent(e, im.mode, im.isTouchDevice);
      if (decision !== 'allow') return;

      // Prevent Scribble/scroll interference during active pen stroke
      if (e.pointerType === 'pen') e.preventDefault();

      // Transition from pen-down to drawing on first move
      if (stroke.phase === 'pen-down') {
        stroke.phase = 'drawing';
      }

      // Process ALL coalesced points — critical for smooth fast strokes
      const vp = store.viewport;
      const newPoints = extractRawCoalescedPoints(e, canvas, vp);

      // Deduplication: skip points too close to the last point (prevents micro-jitter)
      const minDist = MIN_POINT_DISTANCE / vp.zoom;
      for (const pt of newPoints) {
        const dx = pt[0] - stroke.lastX;
        const dy = pt[1] - stroke.lastY;
        if (Math.hypot(dx, dy) >= minDist || stroke.points.length < 2) {
          stroke.points.push(pt);
          stroke.lastX = pt[0];
          stroke.lastY = pt[1];
        }
      }

      stroke.lastEventTime = performance.now();

      // Update store element with accumulated points
      store.updateElement(stroke.elementId, {
        points: [...stroke.points],
        simulatePressure: e.pointerType !== 'pen',
      });
      currentElementRef.current = {
        ...currentElementRef.current!,
        points: [...stroke.points],
      } as FreehandElement;
    }

    function handleNativeFreehandUp(e: PointerEvent) {
      const stroke = activeStrokeRef.current;
      if (!stroke || stroke.pointerId !== e.pointerId) return;

      // Add final position (pressure 0 at lift = tapered stroke end)
      const vp = useCanvasStore.getState().viewport;
      const rect = canvas.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - vp.x) / vp.zoom;
      const worldY = (e.clientY - rect.top - vp.y) / vp.zoom;
      const dx = worldX - stroke.lastX;
      const dy = worldY - stroke.lastY;
      if (Math.hypot(dx, dy) > 0.1) {
        stroke.points.push([worldX, worldY, 0]);
      }

      finalizeActiveStroke('pointer-up');
    }

    // CRITICAL: iOS fires pointercancel instead of pointerup when Scribble
    // or system gestures steal the pointer. DO NOT discard — save the stroke.
    function handleNativeFreehandCancel(e: PointerEvent) {
      const stroke = activeStrokeRef.current;
      if (!stroke || stroke.pointerId !== e.pointerId) return;
      console.warn('[Drawer] pointercancel — completing stroke with existing points');
      finalizeActiveStroke('pointer-cancel');
    }

    function handleLostPointerCapture(e: PointerEvent) {
      const stroke = activeStrokeRef.current;
      if (!stroke || stroke.pointerId !== e.pointerId) return;
      if (stroke.phase === 'drawing' || stroke.phase === 'pen-down') {
        console.warn('[Drawer] lostpointercapture — completing open stroke');
        finalizeActiveStroke('lost-capture');
      }
    }

    // Use { passive: false } so we can call preventDefault() to block Scribble
    canvas.addEventListener('pointerdown', handleNativeFreehandDown, { passive: false });
    canvas.addEventListener('pointermove', handleNativeFreehandMove, { passive: false });
    canvas.addEventListener('pointerup', handleNativeFreehandUp, { passive: false });
    canvas.addEventListener('pointercancel', handleNativeFreehandCancel, { passive: false });
    canvas.addEventListener('lostpointercapture', handleLostPointerCapture, { passive: true });

    return () => {
      canvas.removeEventListener('pointerdown', handleNativeFreehandDown);
      canvas.removeEventListener('pointermove', handleNativeFreehandMove);
      canvas.removeEventListener('pointerup', handleNativeFreehandUp);
      canvas.removeEventListener('pointercancel', handleNativeFreehandCancel);
      canvas.removeEventListener('lostpointercapture', handleLostPointerCapture);
    };
  }, [finalizeActiveStroke, setIsInteracting, setMode]);

  // ── Window-level fallback listeners for missed pen-up events ───────────
  // iOS sometimes delivers pointerup to window instead of canvas
  useEffect(() => {
    function handleWindowPointerUp(e: PointerEvent) {
      const stroke = activeStrokeRef.current;
      if (!stroke || stroke.pointerId !== e.pointerId) return;
      if (stroke.phase === 'drawing' || stroke.phase === 'pen-down') {
        console.warn('[Drawer] window pointerup caught missed canvas pointerup');
        finalizeActiveStroke('pointer-up');
      }
    }

    function handleWindowPointerCancel(e: PointerEvent) {
      const stroke = activeStrokeRef.current;
      if (!stroke || stroke.pointerId !== e.pointerId) return;
      if (stroke.phase === 'drawing' || stroke.phase === 'pen-down') {
        finalizeActiveStroke('pointer-cancel');
      }
    }

    // visibilitychange: user switches app mid-stroke (iPad multitasking)
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden' && activeStrokeRef.current) {
        finalizeActiveStroke('force-complete');
      }
    }

    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [finalizeActiveStroke]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Skip if a text input is focused
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case 'Escape':
          // Deselect all and return to select tool
          clearSelection();
          setTool('select');
          break;

        case 'Delete':
        case 'Backspace': {
          // Delete selected elements
          const ids = Array.from(useCanvasStore.getState().selectedIds);
          if (ids.length > 0) {
            saveSnapshot();
            deleteElements(ids);
          }
          break;
        }

        case 'v':
        case 'V':
          if (!e.metaKey && !e.ctrlKey) {
            setTool('select');
          }
          break;

        case 'a':
        case 'A':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            useCanvasStore.getState().selectAll();
          }
          break;
      }
    };

    const onPaste = async (e: ClipboardEvent) => {
      // Skip if a text input is focused
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.clipboardData && e.clipboardData.items) {
        const items = Array.from(e.clipboardData.items);
        for (const item of items) {
          if (item.type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) {
              const imageHandler = new ImageHandler();
              const state = useCanvasStore.getState();
              // Place in center of viewport
              const cx = state.viewport.x + (state.viewport.width || window.innerWidth) / 2 / state.viewport.zoom;
              const cy = state.viewport.y + (state.viewport.height || window.innerHeight) / 2 / state.viewport.zoom;
              try {
                const element = await imageHandler.handleImageDrop(file, cx, cy);
                state.addElement(element);
                state.selectElements([element.id]);
              } catch (err) {
                console.error('Failed to paste image', err);
              }
            }
            break;
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onPaste);
    };
  }, [clearSelection, setTool, deleteElements, saveSnapshot]);

  // Keep spatial index up to date (debounced for non-eraser updates)
  const debouncedUpdateIndex = useMemo(
    () => debounce((els: Record<string, WhiteboardElement>) => {
      spatialIndexRef.current.rebuild(els);
    }, 200),
    []
  );

  useEffect(() => {
    debouncedUpdateIndex(elements);
  }, [elements, debouncedUpdateIndex]);

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
        grid,
        canvasBackground,
        resolvedTheme
      );

      // Draw rubber-band selection rectangle (Excalidraw style)
      if (selectionBox && modeRef.current === 'selecting') {
        const ctx = canvasRef.current!.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.translate(viewport.x, viewport.y);
          ctx.scale(viewport.zoom, viewport.zoom);

          const x = Math.min(selectionBox.start.x, selectionBox.end.x);
          const y = Math.min(selectionBox.start.y, selectionBox.end.y);
          const w = Math.abs(selectionBox.end.x - selectionBox.start.x);
          const h = Math.abs(selectionBox.end.y - selectionBox.start.y);

          // Left→Right = contain mode (solid blue), Right→Left = crossing mode (dashed purple)
          const isCrossing = selectionBox.end.x < selectionBox.start.x;

          if (isCrossing) {
            // Crossing / intersect mode — dashed purple (like AutoCAD crossing selection)
            ctx.fillStyle = 'rgba(100, 80, 200, 0.07)';
            ctx.strokeStyle = 'rgba(120, 80, 220, 0.8)';
            ctx.setLineDash([6 / viewport.zoom, 3 / viewport.zoom]);
          } else {
            // Contain mode — solid blue
            ctx.fillStyle = 'rgba(30, 100, 255, 0.07)';
            ctx.strokeStyle = 'rgba(30, 100, 255, 0.8)';
            ctx.setLineDash([]);
          }

          ctx.lineWidth = 1.5 / viewport.zoom;
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
          ctx.restore();
        }
      }

      // Draw binding highlight
      const hoveredBindTarget = useCanvasStore.getState().hoveredBindTarget;
      if (hoveredBindTarget) {
        const el = elements[hoveredBindTarget];
        if (el) {
          const ctx = canvasRef.current!.getContext('2d');
          if (ctx) {
            ctx.save();
            ctx.translate(viewport.x, viewport.y);
            ctx.scale(viewport.zoom, viewport.zoom);
            ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2 / viewport.zoom;
            ctx.fillRect(el.x - 4, el.y - 4, el.width + 8, el.height + 8);
            ctx.strokeRect(el.x - 4, el.y - 4, el.width + 8, el.height + 8);
            
            // Draw small anchor dots
            const manager = new ConnectorManager();
            const anchors = manager.getAnchorPoints(el);
            ctx.fillStyle = '#ffffff';
            for (const [key, pos] of Object.entries(anchors)) {
              if (key === 'center') continue;
              ctx.beginPath();
              ctx.arc(pos.x, pos.y, 4 / viewport.zoom, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
            ctx.restore();
          }
        }
      }


      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [elements, selectedIds, viewport, grid, selectionBox, canvasBackground, resolvedTheme]);

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


  const handlePointerDown = (e: React.PointerEvent) => {
    const decision = gatePointerEvent(e.nativeEvent, inputMode.mode, inputMode.isTouchDevice);
    if (decision === 'block-touch') return;
    if (decision === 'block-pen') return;

    if (e.button === 2) return; // ignore right-click

    // Tablet Palm Rejection and Gestures
    const nativeEvent = e.nativeEvent;
    const result = gestureHandler.onPointerDown(nativeEvent);

    if (result === 'reject') {
      rejectedPointers.current.add(e.pointerId);
      return;
    }

    if (result === 'gesture') {
      // Two-finger gesture starting — cancel any active drawing stroke
      if (modeRef.current === 'drawing') {
        const lastEl = elements[currentElementRef.current?.id || ''];
        if (lastEl) deleteElements([lastEl.id]);
      }
      setMode('panning');
      return;
    }

    // Update Input State
    setInputState({
      activePointerType: e.pointerType as 'mouse' | 'pen' | 'touch',
      lastPressure: e.pressure,
    });

    // Close text editing
    if (textEditingId && modeRef.current === 'text-editing') {
      commitTextEdit();
    }

    (e.target as Element).setPointerCapture(e.pointerId);
    setIsInteracting(true);
    const screen: Point = { x: e.clientX, y: e.clientY };
    const world = screenToWorld(e.clientX, e.clientY);
    lastPointerPos.current = screen;
    lastPointerWorldPos.current = world;

    // Middle button or hand tool → pan
    if (e.button === 1 || tool === 'hand') {
      setMode('panning');
      return;
    }

    // Image tool -> trigger file upload
    if (tool === ShapeType.IMAGE) {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
      // Delay tool switch to let dialog open instantly
      setTimeout(() => setTool('select'), 0);
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
      saveSnapshot();
      
      // CRITICAL: Rebuild spatial index synchronously right now so all
      // elements drawn since last debounce tick are included.
      spatialIndexRef.current.rebuild(useCanvasStore.getState().elements);
      
      eraserRef.current?.startErase(world);
      
      // Perform initial erase at the click point
      if (eraserRef.current) {
        const { toDelete, toAdd } = eraserRef.current.erase(
          world,
          useCanvasStore.getState().elements,
          eraserSettings,
          viewport.zoom
        );
        
        if (toDelete.length > 0 || toAdd.length > 0) {
          batchErase(toDelete, toAdd);
        }
      }
      
      setMode('erasing');
      return;
    }

    // ─── UNIVERSAL CLICK-TO-SELECT ───────────────────────────────────────
    const isActiveDraw = modeRef.current === 'drawing' || modeRef.current === 'connector-draw';

    if (!isActiveDraw) {
      const connectorHandleHit = hitTestConnectorHandles(world.x, world.y, elements, Array.from(selectedIds), viewport.zoom);

      if (connectorHandleHit) {
        setMode('connector-reshaping');
        useCanvasStore.getState().setActiveHandle(connectorHandleHit);
        resizeElementIdRef.current = connectorHandleHit.connectorId;
        
        if (connectorHandleHit.handleType === 'control-point') {
           connectorHandleIndexRef.current = connectorHandleHit.controlPointIndex ?? 0;
        } else if (connectorHandleHit.handleType === 'midpoint') {
           connectorHandleIndexRef.current = -1;
        } else {
           setMode('connector-endpoint-drag');
           connectorEndpointRef.current = connectorHandleHit.handleType === 'start-endpoint' ? 'start' : 'end';
        }
        return;
      }

      const hit = hitTestPoint(world.x, world.y, elements, viewport);

      if (hit) {
        const isAlreadySelected = selectedIds.has(hit.elementId);
        
        // Select logic
        if (e.shiftKey) {
          const newSet = new Set(selectedIds);
          if (newSet.has(hit.elementId)) {
            newSet.delete(hit.elementId);
          } else {
            newSet.add(hit.elementId);
          }
          selectElements(Array.from(newSet));
        } else if (!isAlreadySelected) {
          selectElements([hit.elementId]);
        }

        // Setup drag start positions
        dragStartElementPositions.current = {};
        useCanvasStore.getState().selectedIds.forEach(id => {
          const el = elements[id];
          if (el) dragStartElementPositions.current[id] = { x: el.x, y: el.y };
        });

        // Enter drag mode if using select tool
        if (tool === 'select') {
           setMode('dragging');
           return;
        } else if (tool === ShapeType.CONNECTOR || tool === ShapeType.ARROW) {
           // Connectors must be allowed to start on existing elements!
           // Fall through to the connector drawing logic below.
        } else {
           // We clicked an element while holding a shape tool. We just selected it, but we don't start drawing.
           return;
        }
      } else {
        // Clicked empty space
        if (tool === 'select') {
          if (!e.shiftKey) clearSelection();
          setSelectionBox({ start: world, end: world });
          setMode('selecting');
          return;
        } else {
          if (!e.shiftKey) clearSelection();
        }
      }
    }
    // ─── END UNIVERSAL CLICK-TO-SELECT ───────────────────────────────────

    // Freehand drawing — handled by native event listeners (see useEffect above)
    // Native listeners bypass React's synthetic event system to get coalesced
    // points and reliable pen-up on iPad. Skip here to avoid double-processing.
    if (tool === ShapeType.FREEHAND) {
      return;
    }

    // Connector drawing
    if (tool === ShapeType.CONNECTOR || tool === ShapeType.ARROW) {
      const id = uuidv4();
      const manager = new ConnectorManager();
      const nearest = manager.findNearestAnchor(world.x, world.y, elements);
      
      const newConnector: ConnectorElement = {
        id,
        type: ShapeType.CONNECTOR,
        x: world.x,
        y: world.y,
        width: 0,
        height: 0,
        rotation: 0,
        locked: false,
        zIndex: Date.now(),
        style: { ...currentStyle },
        seed: Math.floor(Math.random() * 100000),
        startX: nearest ? nearest.position.x : world.x,
        startY: nearest ? nearest.position.y : world.y,
        endX: world.x,
        endY: world.y,
        startElementId: nearest ? nearest.elementId : null,
        startAnchorPoint: nearest ? nearest.anchorPoint : undefined,
        routingMode: 'curved'
      };
      
      addElement(newConnector as unknown as WhiteboardElement);
      selectElements([id]);
      currentElementRef.current = newConnector as unknown as WhiteboardElement;
      setMode('connector-draw');
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
    const decision = gatePointerEvent(e.nativeEvent, inputMode.mode, inputMode.isTouchDevice);
    if (decision === 'block-touch' || decision === 'block-pen') return;

    const nativeEvent = e.nativeEvent;

    // Skip rejected (palm) pointers
    if (rejectedPointers.current.has(e.pointerId)) return;

    // Handle two-finger gestures
    const wasGesture = gestureHandler.onPointerMove(
      nativeEvent,
      (scale, cx, cy) => {
        // Pinch zoom
        const vp = useCanvasStore.getState().viewport;
        const s = Math.max(0.1, Math.min(vp.zoom * scale, 5));
        const newX = cx - (cx - vp.x) * (s / vp.zoom);
        const newY = cy - (cy - vp.y) * (s / vp.zoom);
        useCanvasStore.getState().updateViewport({ zoom: s, x: newX, y: newY });
      },
      (dx, dy) => {
        // Two-finger pan
        const vp = useCanvasStore.getState().viewport;
        useCanvasStore.getState().updateViewport({ x: vp.x + dx, y: vp.y + dy });
      }
    );

    if (wasGesture) return; // Don't process drawing/panning during gesture

    const screen: Point = { x: e.clientX, y: e.clientY };
    const world = screenToWorld(e.clientX, e.clientY);
    const dx = screen.x - lastPointerPos.current.x;
    const dy = screen.y - lastPointerPos.current.y;

    if (modeRef.current === 'idle' || modeRef.current === 'resizing') {
      const hoverHit = hitTestConnectorHandles(world.x, world.y, elements, Array.from(selectedIds), viewport.zoom);
      if (containerRef.current) {
        if (hoverHit) {
          containerRef.current.style.cursor = hoverHit.handleType === 'midpoint' ? 'grab' : 'crosshair';
        } else {
          containerRef.current.style.cursor = ''; // Let React handle it
        }
      }
    }

    switch (modeRef.current) {
      case 'panning': {
        const vp = useCanvasStore.getState().viewport;
        useCanvasStore.getState().updateViewport({ x: vp.x + dx, y: vp.y + dy });
        break;
      }

      case 'selecting': {
        if (selectionBox) {
          setSelectionBox(prev => prev ? { ...prev, end: world } : null);
          // Excalidraw-style rubber-band:
          // Left→Right drag = contain mode (element fully inside)
          // Right→Left drag = crossing mode (element just needs to intersect)
          const inBox = getElementsInSelectionBox(elements, selectionBox.start, world);
          if (inBox.length > 0) selectElements(inBox);
          else if (!selectionBox.start || Math.hypot(world.x - selectionBox.start.x, world.y - selectionBox.start.y) > 4 / viewport.zoom) clearSelection();
        }
        break;
      }

      case 'dragging': {
        const wdx = world.x - screenToWorld(lastPointerPos.current.x, lastPointerPos.current.y).x;
        const wdy = world.y - screenToWorld(lastPointerPos.current.x, lastPointerPos.current.y).y;
        // Move all selected elements
        const freshElements = useCanvasStore.getState().elements;
        const movedIds = Object.keys(dragStartElementPositions.current);
        movedIds.forEach((id) => {
          const el = freshElements[id];
          if (el) updateElement(id, { x: el.x + wdx, y: el.y + wdy });
        });
        // Trigger connector updates for all moved elements at once
        useCanvasStore.getState().updateAttachedConnectors(movedIds, useCanvasStore.getState().getElementsMap());
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

        if (elId === 'group') {
          const gb = activeGroupBounds.current;
          const startGb = resizeGroupStartBounds.current;
          if (!gb || !startGb) break;

          const preserveRatio = e.shiftKey;
          const newGb = calcResizedBounds(handle, gb.x, gb.y, gb.width, gb.height, wdx, wdy, preserveRatio);
          activeGroupBounds.current = newGb;

          const scaleX = startGb.width === 0 ? 1 : newGb.width / startGb.width;
          const scaleY = startGb.height === 0 ? 1 : newGb.height / startGb.height;

          const movedIds: string[] = [];
          Object.entries(resizeElementStartBoundsRef.current).forEach(([id, startEl]) => {
            const newX = newGb.x + (startEl.x - startGb.x) * scaleX;
            const newY = newGb.y + (startEl.y - startGb.y) * scaleY;
            const newW = startEl.width * scaleX;
            const newH = startEl.height * scaleY;
            const updates: Partial<WhiteboardElement> & { controlPoints?: { x: number; y: number }[] } = { x: newX, y: newY, width: newW, height: newH };
            
            if (startEl.type === ShapeType.CONNECTOR && startEl.controlPoints) {
              updates.controlPoints = startEl.controlPoints.map((cp: Point) => ({
                x: newGb.x + (cp.x - startGb.x) * scaleX,
                y: newGb.y + (cp.y - startGb.y) * scaleY,
              }));
            }
            updateElement(id, updates);
            movedIds.push(id);
          });

          useCanvasStore.getState().updateAttachedConnectors(movedIds, useCanvasStore.getState().getElementsMap());
          break;
        }

        const el = useCanvasStore.getState().elements[elId];
        if (!el) break;

        const preserveRatio = e.shiftKey || (el.type === ShapeType.IMAGE && (el as ImageElement).lockAspectRatio) || el.type === ShapeType.ICON;
        const newBounds = calcResizedBounds(handle, el.x, el.y, el.width, el.height, wdx, wdy, preserveRatio);
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
        // Freehand move is handled by native event listeners (handleNativeFreehandMove)
        // which process coalesced sub-frame points for smooth fast strokes.
        // This React handler is intentionally empty — native takes precedence.
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

      case 'connector-draw': {
        if (!currentElementRef.current) break;
        const el = currentElementRef.current as ConnectorElement;
        const manager = new ConnectorManager();
        const nearest = manager.findNearestAnchor(world.x, world.y, useCanvasStore.getState().elements, el.startElementId || undefined);
        useCanvasStore.getState().setHoveredBindTarget(nearest ? nearest.elementId : null);
        
        const updates: Partial<ConnectorElement> = {
          endX: nearest ? nearest.position.x : world.x,
          endY: nearest ? nearest.position.y : world.y,
          endElementId: nearest ? nearest.elementId : null,
          endAnchorPoint: nearest ? nearest.anchorPoint : undefined,
        };

        const tempConn = { ...el, ...updates } as ConnectorElement;
        manager.computeConnectorPath(tempConn, useCanvasStore.getState().getElementsMap());
        updates.controlPoints = tempConn.controlPoints;

        updateElement(el.id, updates);
        currentElementRef.current = tempConn as unknown as WhiteboardElement;
        break;
      }

      case 'connector-endpoint-drag': {
        const elId = resizeElementIdRef.current;
        const endpoint = connectorEndpointRef.current;
        if (!elId || !endpoint) break;
        
        const store = useCanvasStore.getState();
        const connector = store.getElement(elId) as ConnectorElement;
        if (!connector) break;

        const manager = new ConnectorManager();
        const excludeId = endpoint === 'end' ? connector.startElementId ?? undefined : connector.endElementId ?? undefined;
        const anchorHit = manager.findNearestAnchor(world.x, world.y, store.elements, excludeId);

        store.setHoveredBindTarget(anchorHit?.elementId ?? null);

        const updates: Partial<ConnectorElement> = {
          isManuallyRouted: false,
        };
        
        if (endpoint === 'end') {
          updates.endX = anchorHit ? anchorHit.position.x : world.x;
          updates.endY = anchorHit ? anchorHit.position.y : world.y;
          updates.endElementId = anchorHit?.elementId ?? null;
          updates.endAnchorPoint = anchorHit?.anchorPoint ?? undefined;
        } else {
          updates.startX = anchorHit ? anchorHit.position.x : world.x;
          updates.startY = anchorHit ? anchorHit.position.y : world.y;
          updates.startElementId = anchorHit?.elementId ?? null;
          updates.startAnchorPoint = anchorHit?.anchorPoint ?? undefined;
        }

        const tempConn = { ...connector, ...updates } as ConnectorElement;
        const path = manager.computeConnectorPath(tempConn, store.getElementsMap());
        updates.controlPoints = path.controlPoints;

        updateElement(elId, updates);
        break;
      }

      case 'connector-reshaping': {
        const elId = resizeElementIdRef.current;
        const hIdx = connectorHandleIndexRef.current;
        if (!elId || hIdx === null) break;
        
        const el = useCanvasStore.getState().elements[elId] as ConnectorElement;
        if (!el) break;
        
        const manager = new ConnectorManager();
        let newCp = el.controlPoints ? [...el.controlPoints] : [];
        
        if (hIdx === -1) {
            const resolved = manager.resolveConnectorEndpoints(el, useCanvasStore.getState().getElementsMap());
            const { startX, startY, endX, endY } = resolved;
            
            // Re-import to avoid conflict? It's exported from connectors.ts
            // But I didn't import reshapeConnectorFromMidpoint in Canvas.tsx! 
            // Wait, connectorManager can just expose it or I can import it.
            // Wait, we can just do the math inline here or import it.
            // Oh, I can just do the math inline:
            const cpX = (4 * world.x - startX - endX) / 2;
            const cpY = (4 * world.y - startY - endY) / 2;
            const tangentX = (endX - startX) * 0.1;
            const tangentY = (endY - startY) * 0.1;
            
            newCp = [
              { x: cpX - tangentX, y: cpY - tangentY },
              { x: cpX + tangentX, y: cpY + tangentY }
            ];
        } else {
            const wdx = world.x - lastPointerWorldPos.current!.x;
            const wdy = world.y - lastPointerWorldPos.current!.y;
            
            if (newCp.length === 0) {
              const path = manager.computeConnectorPath(el, useCanvasStore.getState().getElementsMap());
              if (path.controlPoints && path.controlPoints.length >= 2) {
                newCp = [...path.controlPoints];
              } else {
                const resolved = manager.resolveConnectorEndpoints(el, useCanvasStore.getState().getElementsMap());
                const { startX, startY, endX, endY } = resolved;
                newCp = [
                  { x: startX + (endX - startX) / 3, y: startY + (endY - startY) / 3 },
                  { x: startX + 2 * (endX - startX) / 3, y: startY + 2 * (endY - startY) / 3 }
                ];
              }
            }

            if (hIdx === 0 && newCp[0]) {
               newCp[0].x += wdx; newCp[0].y += wdy;
            } else if (hIdx === 1 && newCp[1]) {
               newCp[1].x += wdx; newCp[1].y += wdy;
            }
        }
        
        updateElement(elId, { 
          controlPoints: newCp, 
          isManuallyRouted: true,
          routingMode: (!el.routingMode || el.routingMode === 'straight') ? 'curved' : el.routingMode
        });
        break;
      }

      case 'erasing': {
        if (eraserRef.current) {
          const { toDelete, toAdd } = eraserRef.current.erase(
            world,
            useCanvasStore.getState().elements,
            eraserSettings,
            viewport.zoom
          );
          
          if (toDelete.length > 0 || toAdd.length > 0) {
            // Apply immediately — spatial index is already updated inside EraserManager
            batchErase(toDelete, toAdd);
          }
        }
        break;
      }

      default:
        break;
    }

    lastPointerPos.current = screen;
    lastPointerWorldPos.current = world;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handlePointerUp = (e: React.PointerEvent) => {
    const decision = gatePointerEvent(e.nativeEvent, inputMode.mode, inputMode.isTouchDevice);
    if (decision === 'block-touch' || decision === 'block-pen') return;

    rejectedPointers.current.delete(e.pointerId);
    gestureHandler.onPointerUp(e.nativeEvent);

    const prevMode = modeRef.current;

    if (prevMode === 'selecting') {
      setSelectionBox(null);
    }
    
    if (prevMode === 'drawing' || prevMode === 'freehand') {
      const el = currentElementRef.current;
      // Remove zero-size elements (just a click) — shape drawing only
      if (el && Math.abs(el.width) < 2 && Math.abs(el.height) < 2 && el.type !== ShapeType.FREEHAND) {
        deleteElements([el.id]);
        clearSelection();
      }
      // Freehand completion is handled by native listeners (finalizeActiveStroke).
      // If we arrive here with an active stroke still open, finalize it as a safety fallback.
      if (prevMode === 'freehand' && activeStrokeRef.current) {
        finalizeActiveStroke('pointer-up');
        return; // finalizeActiveStroke handles mode reset
      }
      currentElementRef.current = null;
    }

    if (prevMode === 'connector-draw') {
      useCanvasStore.getState().setHoveredBindTarget(null);
      const el = currentElementRef.current as ConnectorElement;
      if (el && Math.hypot(el.endX - el.startX, el.endY - el.startY) < 5) {
        deleteElements([el.id]);
        clearSelection();
      }
      saveSnapshot();
      currentElementRef.current = null;
      resizeElementIdRef.current = null;
      connectorHandleIndexRef.current = null;
    } else if (prevMode === 'connector-reshaping') {
      saveSnapshot();
      currentElementRef.current = null;
      resizeElementIdRef.current = null;
      connectorHandleIndexRef.current = null;
    } else if (prevMode === 'connector-endpoint-drag') {
      const store = useCanvasStore.getState();
      const elId = resizeElementIdRef.current;
      const endpoint = connectorEndpointRef.current;
      
      if (elId && endpoint) {
        const connector = store.getElement(elId) as ConnectorElement;
        if (connector) {
          const manager = new ConnectorManager();
          const excludeId = endpoint === 'end' ? connector.startElementId ?? undefined : connector.endElementId ?? undefined;
          const worldPos = lastPointerWorldPos.current!;
          const anchorHit = manager.findNearestAnchor(worldPos.x, worldPos.y, store.elements, excludeId);
          
          const updates: Partial<ConnectorElement> = {};
          if (endpoint === 'end') {
            updates.endX = anchorHit ? anchorHit.position.x : worldPos.x;
            updates.endY = anchorHit ? anchorHit.position.y : worldPos.y;
            updates.endElementId = anchorHit?.elementId ?? null;
            updates.endAnchorPoint = anchorHit?.anchorPoint ?? undefined;
          } else {
            updates.startX = anchorHit ? anchorHit.position.x : worldPos.x;
            updates.startY = anchorHit ? anchorHit.position.y : worldPos.y;
            updates.startElementId = anchorHit?.elementId ?? null;
            updates.startAnchorPoint = anchorHit?.anchorPoint ?? undefined;
          }
          store.updateElement(elId, updates);
        }
      }
      
      store.setHoveredBindTarget(null);
      saveSnapshot();
      resizeElementIdRef.current = null;
      connectorEndpointRef.current = null;
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
      resizeGroupStartBounds.current = null;
      activeGroupBounds.current = null;
      resizeElementStartBoundsRef.current = {};
      resizeElementIdRef.current = null;
      rotateElementIdRef.current = null;
    }

    if (prevMode === 'erasing') {
      eraserRef.current?.endErase();
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
      const selectedArray = getSelectedElements();
      
      if (selectedArray.length === 1 && selectedArray[0].type === ShapeType.CONNECTOR) {
         const conn = selectedArray[0] as ConnectorElement;
         const handleHit = hitTestConnectorHandles(world.x, world.y, elements, [conn.id], viewport.zoom);
         
         if (handleHit?.handleType === 'midpoint') {
             useCanvasStore.getState().setActiveHandle(null);
             updateElement(conn.id, { isManuallyRouted: false, controlPoints: undefined, routingMode: 'curved' });
             return;
         }
      }

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
  const openTextEditor = (el: TextElement | ConnectorElement) => {
    setTextEditingId(el.id);
    setMode('text-editing');

    let screenX, screenY, screenW, screenH, fontSize, fontFamily, color, text;

    if (el.type === ShapeType.TEXT) {
      screenX = el.x * viewport.zoom + viewport.x;
      screenY = el.y * viewport.zoom + viewport.y;
      screenW = Math.max(el.width * viewport.zoom, 100);
      screenH = Math.max(el.height * viewport.zoom, 40);
      fontSize = el.fontSize || 18;
      fontFamily = el.fontFamily || 'Inter, sans-serif';
      color = el.color || el.style.stroke;
      text = el.text;
    } else if (el.type === ShapeType.CONNECTOR) {
      const manager = new ConnectorManager();
      const resolved = manager.resolveConnectorEndpoints(el, useCanvasStore.getState().getElementsMap());
      const mid = manager.getPointOnCurve(0.5, resolved.startX, resolved.startY, resolved.endX, resolved.endY, el.controlPoints);
      screenX = mid.x * viewport.zoom + viewport.x - 50; // offset for centering roughly
      screenY = mid.y * viewport.zoom + viewport.y - 20;
      screenW = 100;
      screenH = 40;
      fontSize = 18;
      fontFamily = 'Inter, sans-serif';
      color = el.style.stroke;
      text = el.label || '';
    } else {
      return;
    }

    setTextEditorStyle({
      position: 'fixed',
      left: screenX,
      top: screenY,
      width: screenW,
      minHeight: screenH,
      fontSize: fontSize * viewport.zoom,
      fontFamily: fontFamily,
      color: color,
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
        textAreaRef.current.value = text;
        textAreaRef.current.focus();
        textAreaRef.current.select();
      }
    }, 10);
  };

  const commitTextEdit = () => {
    if (!textEditingId || !textAreaRef.current) return;
    const textValue = textAreaRef.current.value;
    const el = elements[textEditingId];
    if (!el) {
      setTextEditingId(null);
      return;
    }
    
    if (el.type === ShapeType.CONNECTOR) {
      updateElement(textEditingId, { label: textValue });
      saveSnapshot();
    } else {
      if (textValue.trim() === '') {
        deleteElements([textEditingId]);
      } else {
        updateElement(textEditingId, { text: textValue, width: Math.max(200, textValue.length * 10), height: 40 });
        saveSnapshot();
      }
    }
    setTextEditingId(null);
    setMode('idle');
    setTool('select');
  };

  // --- Resize handle hit detection (for SelectionBox element) ---
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      if (el.type !== ShapeType.CONNECTOR) {
        activeSelectionBox = {
          box: { minX: el.x, minY: el.y, maxX: el.x + el.width, maxY: el.y + el.height },
          rotation: el.rotation || 0,
          isMultiple: false,
        };
      }
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
    if (tool === ShapeType.IMAGE) return 'crosshair';
    return 'crosshair';
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const world = lastPointerWorldPos.current || { x: 0, y: 0 };
      const imageHandler = new ImageHandler();
      try {
        const element = await imageHandler.handleImageDrop(file, world.x, world.y);
        addElement(element);
        selectElements([element.id]);
      } catch (err) {
        console.error('Failed to load image', err);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file && file.type.indexOf('image') !== -1) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
          const imageHandler = new ImageHandler();
          try {
            const element = await imageHandler.handleImageDrop(file, world.x, world.y);
            addElement(element);
            selectElements([element.id]);
          } catch (err) {
            console.error('Failed to load dropped image', err);
          }
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-background touch-none"
      style={{ cursor: getCursor(), overflow: 'hidden' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      // Tells iPadOS this region is not a text input area — disables Scribble
      inputMode="none"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      data-canvas-container
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        hidden 
        accept=".png,.jpg,.jpeg,.gif,.webp,.svg" 
        onChange={handleImageFileSelect} 
      />
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        className="absolute inset-0"
        style={{
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
          cursor: 'crosshair',
        }}
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
            const selectedArray = getSelectedElements();
            if (selectedArray.length === 0) return;
            resizeHandleRef.current = handle;
            
            if (selectedArray.length === 1) {
              const el = selectedArray[0]!;
              resizeStartBounds.current = { x: el.x, y: el.y, width: el.width, height: el.height };
              resizeElementIdRef.current = el.id;
            } else {
              resizeElementIdRef.current = 'group';
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              const startBounds: Record<string, { x: number; y: number; width: number; height: number; type: string; controlPoints?: { x: number; y: number }[] }> = {};
              selectedArray.forEach(el => {
                minX = Math.min(minX, el.x);
                minY = Math.min(minY, el.y);
                maxX = Math.max(maxX, el.x + el.width);
                maxY = Math.max(maxY, el.y + el.height);
                startBounds[el.id] = { 
                  x: el.x, 
                  y: el.y, 
                  width: el.width, 
                  height: el.height, 
                  type: el.type, 
                  controlPoints: el.type === ShapeType.CONNECTOR ? (el as ConnectorElement).controlPoints : undefined 
                };
              });
              const gb = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
              resizeGroupStartBounds.current = gb;
              activeGroupBounds.current = { ...gb };
              resizeElementStartBoundsRef.current = startBounds;
            }
            
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

      <PenCursor 
        canvasRef={canvasRef} 
        activeTool={tool} 
        color={currentStyle.stroke} 
        strokeSize={currentStyle.strokeWidth} 
      />

      <IconPicker />

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
