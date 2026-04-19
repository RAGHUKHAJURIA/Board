'use client';

import { useEffect } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { ShapeType } from '@/types';

export function useKeyboardShortcuts() {
  const setTool = useCanvasStore(state => state.setTool);
  const deleteElements = useCanvasStore(state => state.deleteElements);
  const selectedIds = useCanvasStore(state => state.selectedIds);
  const elements = useCanvasStore(state => state.elements);
  const selectAll = useCanvasStore(state => state.selectAll);
  const clearSelection = useCanvasStore(state => state.clearSelection);
  const undo = useCanvasStore(state => state.undo);
  const redo = useCanvasStore(state => state.redo);
  const canUndo = useCanvasStore(state => state.canUndo);
  const canRedo = useCanvasStore(state => state.canRedo);
  const copy = useCanvasStore(state => state.copy);
  const paste = useCanvasStore(state => state.paste);
  const duplicate = useCanvasStore(state => state.duplicate);
  const updateElement = useCanvasStore(state => state.updateElement);
  const bringToFront = useCanvasStore(state => state.bringToFront);
  const sendToBack = useCanvasStore(state => state.sendToBack);
  const viewport = useCanvasStore(state => state.viewport);
  const setZoom = useCanvasStore(state => state.setZoom);
  const zoomToFit = useCanvasStore(state => state.zoomToFit);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in form elements or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const key = e.key.toLowerCase();

      // --- Tool Shortcuts (no modifier) ---
      if (!isCtrl) {
        switch (key) {
          case 'v':
            if (!isShift) { e.preventDefault(); setTool('select'); }
            break;
          case 'h':
            e.preventDefault(); setTool('hand');
            break;
          case 'r':
            e.preventDefault(); setTool(ShapeType.RECTANGLE);
            break;
          case 'o':
            e.preventDefault(); setTool(ShapeType.CIRCLE);
            break;
          case 'l':
            e.preventDefault(); setTool(ShapeType.LINE);
            break;
          case 'a':
            if (!isCtrl) { e.preventDefault(); setTool(ShapeType.ARROW); }
            break;
          case 'p':
            e.preventDefault(); setTool(ShapeType.FREEHAND);
            break;
          case 't':
            e.preventDefault(); setTool(ShapeType.TEXT);
            break;
          case 'e':
            e.preventDefault(); setTool('eraser');
            break;
          case 'escape':
            e.preventDefault();
            clearSelection();
            setTool('select');
            break;
        }
      }

      // --- Delete / Backspace ---
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isCtrl) {
        if (selectedIds.size > 0) {
          e.preventDefault();
          deleteElements(Array.from(selectedIds));
        }
      }

      // --- Arrow key nudging ---
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && !isCtrl) {
        if (selectedIds.size > 0) {
          e.preventDefault();
          const nudge = isShift ? 10 : 1;
          const dx = key === 'arrowright' ? nudge : key === 'arrowleft' ? -nudge : 0;
          const dy = key === 'arrowdown' ? nudge : key === 'arrowup' ? -nudge : 0;
          Array.from(selectedIds).forEach(id => {
            const el = elements[id];
            if (el) updateElement(id, { x: el.x + dx, y: el.y + dy });
          });
        }
      }

      // --- Ctrl/Cmd shortcuts ---
      if (isCtrl) {
        switch (key) {
          case 'z':
            e.preventDefault();
            if (isShift) { if (canRedo()) redo(); }
            else { if (canUndo()) undo(); }
            break;
          case 'y':
            e.preventDefault();
            if (canRedo()) redo();
            break;
          case 'c':
            e.preventDefault();
            if (selectedIds.size > 0) copy();
            break;
          case 'x':
            e.preventDefault();
            if (selectedIds.size > 0) {
              copy();
              deleteElements(Array.from(selectedIds));
            }
            break;
          case 'v':
            e.preventDefault();
            paste();
            break;
          case 'd':
            e.preventDefault();
            if (selectedIds.size > 0) duplicate();
            break;
          case 'a':
            e.preventDefault();
            selectAll();
            break;
          case '=':
          case '+':
            e.preventDefault();
            setZoom(viewport.zoom * 1.2);
            break;
          case '-':
            e.preventDefault();
            setZoom(viewport.zoom / 1.2);
            break;
          case '0':
            e.preventDefault();
            setZoom(1);
            break;
          case '1':
            e.preventDefault();
            zoomToFit();
            break;
          case ']':
            e.preventDefault();
            Array.from(selectedIds).forEach(id => bringToFront(id));
            break;
          case '[':
            e.preventDefault();
            Array.from(selectedIds).forEach(id => sendToBack(id));
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, elements, viewport.zoom]);
}
