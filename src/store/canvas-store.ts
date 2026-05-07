import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { WhiteboardElement, ConnectorElement, Viewport, Tool, ShapeType } from '@/types';
import { getElementBBox } from '@/lib/utils/geometry';
import { ConnectorManager } from '@/lib/canvas/connectors';

// Enable Immer MapSet plugin for using Set/Map in Immer state
enableMapSet();

interface HistorySnapshot {
  elements: Record<string, WhiteboardElement>;
}

interface CanvasState {
  elements: Record<string, WhiteboardElement>;
  selectedIds: Set<string>;
  viewport: Viewport;
  tool: Tool;
  clipboard: WhiteboardElement[];
  isInteracting: boolean;

  // History for proper undo/redo
  history: HistorySnapshot[];
  historyIndex: number;

  // Actions
  setIsInteracting: (val: boolean) => void;
  setTool: (tool: Tool) => void;
  addElement: (element: WhiteboardElement) => void;
  updateElement: (id: string, updates: Partial<WhiteboardElement>) => void;
  deleteElements: (ids: string[]) => void;
  selectElements: (ids: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;
  updateViewport: (viewport: Partial<Viewport>) => void;

  // Undo/redo
  saveSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Clipboard
  copy: () => void;
  paste: () => void;
  duplicate: () => void;

  // Z-index management
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;

  // Alignment
  alignElements: (alignment: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => void;

  // Zoom helpers
  zoomToFit: () => void;
  setZoom: (zoom: number) => void;

  // Eraser Settings
  eraserSettings: {
    mode: 'object' | 'partial';
    size: number;
  };
  setEraserMode: (mode: 'object' | 'partial') => void;
  setEraserSize: (size: number) => void;

  // Batch erase (no history — caller manages snapshot)
  batchErase: (deleteIds: string[], addElements?: WhiteboardElement[]) => void;

  // Connectors
  connectorsByElement: Map<string, Set<string>>;
  hoveredBindTarget: string | null;
  setHoveredBindTarget: (id: string | null) => void;
  draftConnector: ConnectorElement | null;
  beginDrawingConnector: (connector: ConnectorElement) => void;
  updateDraftConnector: (updates: Partial<ConnectorElement>) => void;
  commitConnector: (connector: ConnectorElement) => void;
  cancelDraftConnector: () => void;
  getElementsMap: () => Map<string, WhiteboardElement>;
  getElement: (id: string) => WhiteboardElement | undefined;
  updateAttachedConnectors: (movedElementIds: string[], elementsMap: Map<string, WhiteboardElement>) => void;
  detachConnectorsFromElement: (elementId: string) => void;
  finalizeConnectorReshape: (connectorId: string) => void;
  setConnectorRoutingMode: (connectorId: string, mode: 'straight' | 'curved' | 'orthogonal') => void;
}

const cloneElements = (elements: Record<string, WhiteboardElement>): Record<string, WhiteboardElement> => {
  return JSON.parse(JSON.stringify(elements));
};

export const useCanvasStore = create<CanvasState>()(
  immer((set, get) => ({
    elements: {},
    selectedIds: new Set(),
    viewport: { x: 0, y: 0, zoom: 1, width: 0, height: 0 },
    tool: 'select',
    clipboard: [],
    isInteracting: false,
    history: [{ elements: {} }],
    historyIndex: 0,
    connectorsByElement: new Map(),
    hoveredBindTarget: null,
    draftConnector: null,
    eraserSettings: {
      mode: 'object',
      size: 30,
    },

    setEraserMode: (mode) => set((state) => {
      state.eraserSettings.mode = mode;
    }),

    setEraserSize: (size) => set((state) => {
      state.eraserSettings.size = size;
    }),

    setHoveredBindTarget: (id) => set((state) => {
      state.hoveredBindTarget = id;
    }),

    beginDrawingConnector: (connector) => set((state) => {
      state.draftConnector = connector as typeof state.draftConnector;
    }),

    updateDraftConnector: (updates) => set((state) => {
      if (state.draftConnector) {
        state.draftConnector = { ...state.draftConnector, ...updates };
      }
    }),

    commitConnector: (connector) => {
      get().addElement(connector);
      set((state) => {
        state.draftConnector = null;
      });
    },

    cancelDraftConnector: () => set((state) => {
      state.draftConnector = null;
    }),

    getElementsMap: () => {
      return new Map(Object.entries(get().elements));
    },

    getElement: (id) => {
      return get().elements[id];
    },

    setIsInteracting: (val) => set((state) => {
      state.isInteracting = val;
    }),

    setTool: (tool) => set((state) => {
      state.tool = tool;
      // Clear selection when switching to select tool so nothing is pre-selected
      if (tool === 'select') {
        state.selectedIds.clear();
      }
    }),


    saveSnapshot: () => set((state) => {
      // Truncate future if we're not at the end
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({ elements: cloneElements(state.elements) });
      // Cap at 100 entries
      if (newHistory.length > 100) newHistory.shift();
      state.history = newHistory;
      state.historyIndex = newHistory.length - 1;
    }),

    addElement: (element) => set((state) => {
      // Save snapshot before change
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({ elements: cloneElements(state.elements) });
      if (newHistory.length > 100) newHistory.shift();
      state.history = newHistory;
      state.historyIndex = newHistory.length - 1;
      
      const elWithBBox = { ...element, bbox: getElementBBox(element) };
      state.elements[element.id] = elWithBBox as typeof state.elements[string];

      // Update connectors index if it's a connector
      if (element.type === ShapeType.CONNECTOR) {
        const conn = element as ConnectorElement;
        if (conn.startElementId) {
          if (!state.connectorsByElement.has(conn.startElementId)) state.connectorsByElement.set(conn.startElementId, new Set());
          state.connectorsByElement.get(conn.startElementId)!.add(conn.id);
        }
        if (conn.endElementId) {
          if (!state.connectorsByElement.has(conn.endElementId)) state.connectorsByElement.set(conn.endElementId, new Set());
          state.connectorsByElement.get(conn.endElementId)!.add(conn.id);
        }
      }
    }),

    updateElement: (id, updates) => set((state) => {
      if (state.elements[id]) {
        const updated = { ...state.elements[id]!, ...updates } as typeof state.elements[string];
        updated.bbox = getElementBBox(updated);
        
        // Handle connector specific changes
        if (updated.type === ShapeType.CONNECTOR) {
          const oldConn = state.elements[id] as ConnectorElement;
          const newConn = updated as ConnectorElement;
          
          if (oldConn.startElementId !== newConn.startElementId) {
            if (oldConn.startElementId && state.connectorsByElement.has(oldConn.startElementId)) {
              state.connectorsByElement.get(oldConn.startElementId)!.delete(id);
            }
            if (newConn.startElementId) {
              if (!state.connectorsByElement.has(newConn.startElementId)) state.connectorsByElement.set(newConn.startElementId, new Set());
              state.connectorsByElement.get(newConn.startElementId)!.add(id);
            }
          }
          if (oldConn.endElementId !== newConn.endElementId) {
            if (oldConn.endElementId && state.connectorsByElement.has(oldConn.endElementId)) {
              state.connectorsByElement.get(oldConn.endElementId)!.delete(id);
            }
            if (newConn.endElementId) {
              if (!state.connectorsByElement.has(newConn.endElementId)) state.connectorsByElement.set(newConn.endElementId, new Set());
              state.connectorsByElement.get(newConn.endElementId)!.add(id);
            }
          }
        }
        
        state.elements[id] = updated;
      }
    }),

    deleteElements: (ids) => set((state) => {
      // Save snapshot before deletion
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({ elements: cloneElements(state.elements) });
      if (newHistory.length > 100) newHistory.shift();
      state.history = newHistory;
      state.historyIndex = newHistory.length - 1;

      ids.forEach(id => {
        // Also call detachConnectorsFromElement
        get().detachConnectorsFromElement(id);
        
        const el = state.elements[id];
        if (el?.type === ShapeType.CONNECTOR) {
          const conn = el as ConnectorElement;
          if (conn.startElementId && state.connectorsByElement.has(conn.startElementId)) {
            state.connectorsByElement.get(conn.startElementId)!.delete(id);
          }
          if (conn.endElementId && state.connectorsByElement.has(conn.endElementId)) {
            state.connectorsByElement.get(conn.endElementId)!.delete(id);
          }
        }
        
        delete state.elements[id];
        state.selectedIds.delete(id);
      });
    }),

    // Delete + add elements without touching undo history.
    // Used by the eraser during a drag gesture (snapshot is saved once at pointerdown).
    batchErase: (deleteIds, addElements) => set((state) => {
      deleteIds.forEach(id => {
        get().detachConnectorsFromElement(id);
        
        const el = state.elements[id];
        if (el?.type === ShapeType.CONNECTOR) {
          const conn = el as ConnectorElement;
          if (conn.startElementId && state.connectorsByElement.has(conn.startElementId)) {
            state.connectorsByElement.get(conn.startElementId)!.delete(id);
          }
          if (conn.endElementId && state.connectorsByElement.has(conn.endElementId)) {
            state.connectorsByElement.get(conn.endElementId)!.delete(id);
          }
        }
        
        delete state.elements[id];
        state.selectedIds.delete(id);
      });
      if (addElements) {
        addElements.forEach(el => {
          const elWithBBox = { ...el, bbox: getElementBBox(el) };
          state.elements[el.id] = elWithBBox as typeof state.elements[string];
        });
      }
    }),

    updateAttachedConnectors: (movedElementIds, elementsMap) => set((state) => {
      const visited = new Set<string>();
      const manager = new ConnectorManager();
      
      const processElement = (elementId: string) => {
        if (visited.has(elementId)) return;
        visited.add(elementId);

        const connectorIds = state.connectorsByElement.get(elementId);
        if (!connectorIds) return;

        for (const connectorId of Array.from(connectorIds)) {
          const connector = state.elements[connectorId] as ConnectorElement;
          if (!connector || connector.isManuallyRouted) continue;

          const resolved = manager.resolveConnectorEndpoints(connector, elementsMap);
          
          // Recreate connector to prevent mutating state directly here incorrectly before updateElement, 
          // although we are in immer so we can mutate.
          const tempConnector = { ...connector, ...resolved } as ConnectorElement;
          const path = manager.computeConnectorPath(tempConnector, elementsMap);

          const updatedConnector = {
            ...connector,
            ...resolved,
            controlPoints: path.controlPoints,
            bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 } // Recomputed below
          };
          updatedConnector.bbox = getElementBBox(updatedConnector);
          state.elements[connectorId] = updatedConnector as typeof state.elements[string];
        }
      };

      for (const id of movedElementIds) {
        processElement(id);
      }
    }),

    detachConnectorsFromElement: (elementId) => set((state) => {
      const connIds = state.connectorsByElement.get(elementId);
      if (!connIds) return;
      
      const manager = new ConnectorManager();
      // To get live positions we need a Map
      const elementsMap = new Map(Object.entries(state.elements));

      for (const connId of Array.from(connIds)) {
        const conn = state.elements[connId] as ConnectorElement;
        if (!conn) continue;
        
        if (conn.startElementId === elementId) {
          conn.startElementId = null;
          const resolved = manager.resolveConnectorEndpoints(conn, elementsMap);
          conn.startX = resolved.startX;
          conn.startY = resolved.startY;
        }
        if (conn.endElementId === elementId) {
          conn.endElementId = null;
          const resolved = manager.resolveConnectorEndpoints(conn, elementsMap);
          conn.endX = resolved.endX;
          conn.endY = resolved.endY;
        }
      }
      
      state.connectorsByElement.delete(elementId);
    }),

    finalizeConnectorReshape: (connectorId) => set((state) => {
      const conn = state.elements[connectorId] as ConnectorElement;
      if (conn) {
        conn.isManuallyRouted = true;
      }
    }),

    setConnectorRoutingMode: (connectorId, mode) => set((state) => {
      const conn = state.elements[connectorId] as ConnectorElement;
      if (conn) {
        conn.routingMode = mode;
        conn.isManuallyRouted = false; // Reset manual routing
      }
    }),

    selectElements: (ids) => set((state) => {
      state.selectedIds = new Set(ids);
    }),

    clearSelection: () => set((state) => {
      state.selectedIds.clear();
    }),

    selectAll: () => set((state) => {
      state.selectedIds = new Set(Object.keys(state.elements));
    }),

    updateViewport: (viewportParams) => set((state) => {
      state.viewport = { ...state.viewport, ...viewportParams };
    }),

    undo: () => set((state) => {
      if (state.historyIndex > 0) {
        state.historyIndex--;
        const snapshot = state.history[state.historyIndex];
        if (snapshot) {
          state.elements = cloneElements(snapshot.elements);
          state.selectedIds.clear();
        }
      }
    }),

    redo: () => set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        const snapshot = state.history[state.historyIndex];
        if (snapshot) {
          state.elements = cloneElements(snapshot.elements);
          state.selectedIds.clear();
        }
      }
    }),

    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    copy: () => set((state) => {
      const toCopy = Array.from(state.selectedIds)
        .map(id => state.elements[id])
        .filter(Boolean) as WhiteboardElement[];
      state.clipboard = JSON.parse(JSON.stringify(toCopy));
    }),

    paste: () => set((state) => {
      if (state.clipboard.length === 0) return;
      const newIds: string[] = [];
      
      // Save snapshot
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({ elements: cloneElements(state.elements) });
      state.history = newHistory;
      state.historyIndex = newHistory.length - 1;

      state.clipboard.forEach(el => {
        const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newEl = {
          ...JSON.parse(JSON.stringify(el)),
          id: newId,
          x: el.x + 20,
          y: el.y + 20,
          zIndex: Date.now() + Math.random(),
        } as typeof state.elements[string];
        newEl.bbox = getElementBBox(newEl);
        state.elements[newId] = newEl;
        newIds.push(newId);
      });
      state.selectedIds = new Set(newIds);
    }),

    duplicate: () => {
      get().copy();
      get().paste();
    },

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
      if (state.elements[id]) {
        state.elements[id]!.zIndex += 1;
      }
    }),

    sendBackward: (id) => set((state) => {
      if (state.elements[id]) {
        state.elements[id]!.zIndex -= 1;
      }
    }),

    alignElements: (alignment) => set((state) => {
      const ids = Array.from(state.selectedIds);
      if (ids.length < 2) return;
      const els = ids.map(id => state.elements[id]).filter(Boolean) as WhiteboardElement[];
      
      const minX = Math.min(...els.map(e => e.x));
      const minY = Math.min(...els.map(e => e.y));
      const maxX = Math.max(...els.map(e => e.x + e.width));
      const maxY = Math.max(...els.map(e => e.y + e.height));
      
      ids.forEach(id => {
        const el = state.elements[id];
        if (!el) return;
        
        switch (alignment) {
          case 'left':
            state.elements[id]!.x = minX;
            break;
          case 'center-h':
            state.elements[id]!.x = (minX + maxX) / 2 - el.width / 2;
            break;
          case 'right':
            state.elements[id]!.x = maxX - el.width;
            break;
          case 'top':
            state.elements[id]!.y = minY;
            break;
          case 'center-v':
            state.elements[id]!.y = (minY + maxY) / 2 - el.height / 2;
            break;
          case 'bottom':
            state.elements[id]!.y = maxY - el.height;
            break;
        }
      });
    }),

    zoomToFit: () => set((state) => {
      // Zoom to selected elements if any, otherwise all elements
      const targetIds = state.selectedIds.size > 0 ? Array.from(state.selectedIds) : Object.keys(state.elements);
      const els = targetIds.map(id => state.elements[id]).filter(Boolean) as WhiteboardElement[];
      
      if (els.length === 0) {
        state.viewport = { ...state.viewport, zoom: 1, x: 0, y: 0 };
        return;
      }
      
      const minX = Math.min(...els.map(e => e.x));
      const minY = Math.min(...els.map(e => e.y));
      const maxX = Math.max(...els.map(e => e.x + e.width));
      const maxY = Math.max(...els.map(e => e.y + e.height));
      
      const padding = 80;
      const vw = state.viewport.width || window.innerWidth;
      const vh = state.viewport.height || window.innerHeight;
      
      // Prevent division by zero
      const contentW = Math.max(maxX - minX, 1);
      const contentH = Math.max(maxY - minY, 1);

      const scaleX = (vw - padding * 2) / contentW;
      const scaleY = (vh - padding * 2) / contentH;
      const zoom = Math.min(scaleX, scaleY, 3); // Max 3x zoom
      
      // Perfectly center the scaled content in the viewport
      const scaledW = contentW * zoom;
      const scaledH = contentH * zoom;
      
      state.viewport = {
        ...state.viewport,
        zoom,
        x: -minX * zoom + (vw - scaledW) / 2,
        y: -minY * zoom + (vh - scaledH) / 2,
      };
    }),

    setZoom: (zoom) => set((state) => {
      const clampedZoom = Math.max(0.05, Math.min(zoom, 10));
      const cx = (state.viewport.width || window.innerWidth) / 2;
      const cy = (state.viewport.height || window.innerHeight) / 2;
      const scale = clampedZoom / state.viewport.zoom;
      
      state.viewport = {
        ...state.viewport,
        zoom: clampedZoom,
        x: cx - (cx - state.viewport.x) * scale,
        y: cy - (cy - state.viewport.y) * scale,
      };
    }),
  }))
);
