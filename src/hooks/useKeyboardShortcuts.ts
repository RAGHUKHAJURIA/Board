import { useHotkeys } from 'react-hotkeys-hook';
import { useCanvasStore } from '@/store/canvas-store';
import { useHistoryStore } from '@/store/history-store';
import { SHORTCUTS } from '@/config/shortcuts';
import { ShapeType } from '@/types';

export function useKeyboardShortcuts() {
  const setTool = useCanvasStore(state => state.setTool);
  const deleteElements = useCanvasStore(state => state.deleteElements);
  const selectedIds = useCanvasStore(state => state.selectedIds);
  const elements = useCanvasStore(state => state.elements);
  const selectElements = useCanvasStore(state => state.selectElements);
  const bringToFront = useCanvasStore(state => state.bringToFront);
  const sendToBack = useCanvasStore(state => state.sendToBack);
  
  const { undo, redo, canUndo, canRedo } = useHistoryStore();

  const options = {
    preventDefault: true,
    enableOnFormTags: false,
  };

  // Tool Selection
  useHotkeys(SHORTCUTS.SELECT, () => setTool('select'), options);
  useHotkeys(SHORTCUTS.PEN, () => setTool(ShapeType.FREEHAND), options);
  useHotkeys(SHORTCUTS.TEXT, () => setTool('text'), options);
  useHotkeys(SHORTCUTS.RECTANGLE, () => setTool(ShapeType.RECTANGLE), options);
  useHotkeys(SHORTCUTS.CIRCLE, () => setTool(ShapeType.ELLIPSE), options);
  useHotkeys(SHORTCUTS.LINE, () => setTool(ShapeType.LINE), options);
  useHotkeys(SHORTCUTS.ARROW, () => setTool(ShapeType.ARROW), options);
  useHotkeys(SHORTCUTS.ERASER, () => setTool('eraser'), options);
  useHotkeys(SHORTCUTS.HAND, () => setTool('hand'), options);

  // History
  useHotkeys(SHORTCUTS.UNDO, () => {
    if (canUndo()) {
      const entry = undo();
      if (entry) {
        // Apply undo logic (restore elements state to previous snapshot)
        // Simplified for Phase 1
      }
    }
  }, options);

  useHotkeys(SHORTCUTS.REDO, () => {
    if (canRedo()) {
      const entry = redo();
      if (entry) {
        // Apply redo logic
      }
    }
  }, options);

  // Edit
  useHotkeys(SHORTCUTS.DELETE, () => {
    if (selectedIds.size > 0) {
      deleteElements(Array.from(selectedIds));
    }
  }, options);

  useHotkeys(SHORTCUTS.SELECT_ALL, () => {
    selectElements(Object.keys(elements));
  }, options);

  // Arrange
  useHotkeys(SHORTCUTS.BRING_FRONT, () => {
    Array.from(selectedIds).forEach(id => bringToFront(id));
  }, options);

  useHotkeys(SHORTCUTS.SEND_BACK, () => {
    Array.from(selectedIds).forEach(id => sendToBack(id));
  }, options);

}
