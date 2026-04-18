import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { WhiteboardElement, Viewport, Tool } from '@/types';

interface CanvasState {
  elements: Record<string, WhiteboardElement>;
  selectedIds: Set<string>;
  viewport: Viewport;
  tool: Tool;
  
  // Actions
  setTool: (tool: Tool) => void;
  addElement: (element: WhiteboardElement) => void;
  updateElement: (id: string, updates: Partial<WhiteboardElement>) => void;
  deleteElements: (ids: string[]) => void;
  selectElements: (ids: string[]) => void;
  clearSelection: () => void;
  updateViewport: (viewport: Partial<Viewport>) => void;
  
  // Z-index management
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
}

export const useCanvasStore = create<CanvasState>()(
  immer((set) => ({
    elements: {},
    selectedIds: new Set(),
    viewport: { x: 0, y: 0, zoom: 1, width: 0, height: 0 },
    tool: 'select',
    
    setTool: (tool) => set((state) => {
      state.tool = tool;
    }),
    
    addElement: (element) => set((state) => {
      state.elements[element.id] = element;
    }),
    
    updateElement: (id, updates) => set((state) => {
      if (state.elements[id]) {
        state.elements[id] = { ...state.elements[id]!, ...updates } as typeof state.elements[string];
      }
    }),
    
    deleteElements: (ids) => set((state) => {
      ids.forEach(id => {
        delete state.elements[id];
        state.selectedIds.delete(id);
      });
    }),
    
    selectElements: (ids) => set((state) => {
      state.selectedIds = new Set(ids);
    }),
    
    clearSelection: () => set((state) => {
      state.selectedIds.clear();
    }),
    
    updateViewport: (viewportParams) => set((state) => {
      state.viewport = { ...state.viewport, ...viewportParams };
    }),

    bringToFront: (id) => set((state) => {
      const zIndices = Object.values(state.elements).map(e => e.zIndex);
      const maxZIndex = zIndices.length > 0 ? Math.max(...zIndices) : 0;
      if (state.elements[id]) {
         state.elements[id]!.zIndex = maxZIndex + 1;
      }
    }),

    sendToBack: (id) => set((state) => {
      const zIndices = Object.values(state.elements).map(e => e.zIndex);
      const minZIndex = zIndices.length > 0 ? Math.min(...zIndices) : 0;
      if (state.elements[id]) {
         state.elements[id]!.zIndex = minZIndex - 1;
      }
    }),

    bringForward: (id) => set((state) => {
      // In a real app, swap with the next element above it
      if (state.elements[id]) {
         state.elements[id]!.zIndex += 1;
      }
    }),

    sendBackward: (id) => set((state) => {
      if (state.elements[id]) {
         state.elements[id]!.zIndex -= 1;
      }
    })
  }))
);
