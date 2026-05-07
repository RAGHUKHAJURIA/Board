const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'store', 'canvas-store.ts');
let content = fs.readFileSync(file, 'utf8');

// 1. Import ConnectorManager and AnchorPoint if needed
// Actually let's just import ConnectorManager at the top
if (!content.includes("import { ConnectorManager }")) {
  content = content.replace("import { getElementBBox } from '@/lib/utils/geometry';", 
    "import { getElementBBox } from '@/lib/utils/geometry';\nimport { ConnectorManager } from '@/lib/canvas/connectors';");
}

// 2. Update CanvasState interface
content = content.replace("connectorsByElement: Record<string, string[]>;", 
`connectorsByElement: Map<string, Set<string>>;
  hoveredBindTarget: string | null;
  setHoveredBindTarget: (id: string | null) => void;
  draftConnector: ConnectorElement | null;
  beginDrawingConnector: (connector: ConnectorElement) => void;
  updateDraftConnector: (updates: Partial<ConnectorElement>) => void;
  commitConnector: (connector: ConnectorElement) => void;
  cancelDraftConnector: () => void;
  getElementsMap: () => Map<string, WhiteboardElement>;
  getElement: (id: string) => WhiteboardElement | undefined;`);

content = content.replace("updateAttachedConnectors: (elementId: string, recalculatePath: (connector: ConnectorElement, elements: Record<string, WhiteboardElement>) => void) => void;",
"updateAttachedConnectors: (movedElementIds: string[], elementsMap: Map<string, WhiteboardElement>) => void;");

// 3. Update initial state
content = content.replace("connectorsByElement: {},", 
`connectorsByElement: new Map(),
    hoveredBindTarget: null,
    draftConnector: null,`);

// Add the new store methods right after setEraserSize
content = content.replace("setEraserSize: (size) => set((state) => {\n      state.eraserSettings.size = size;\n    }),",
`setEraserSize: (size) => set((state) => {
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
    },`);

// 4. Fix addElement
const oldAddElementConnectorLogic = `      // Update connectors index if it's a connector
      if (element.type === ShapeType.CONNECTOR) {
        const conn = element as ConnectorElement;
        if (conn.startElementId) {
          if (!state.connectorsByElement[conn.startElementId]) state.connectorsByElement[conn.startElementId] = [];
          if (!state.connectorsByElement[conn.startElementId].includes(conn.id)) state.connectorsByElement[conn.startElementId].push(conn.id);
        }
        if (conn.endElementId) {
          if (!state.connectorsByElement[conn.endElementId]) state.connectorsByElement[conn.endElementId] = [];
          if (!state.connectorsByElement[conn.endElementId].includes(conn.id)) state.connectorsByElement[conn.endElementId].push(conn.id);
        }
      }`;

const newAddElementConnectorLogic = `      // Update connectors index if it's a connector
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
      }`;
content = content.replace(oldAddElementConnectorLogic, newAddElementConnectorLogic);

// 5. Fix updateElement
const oldUpdateElementConnectorLogic = `        // Handle connector specific changes
        if (updated.type === ShapeType.CONNECTOR) {
          const oldConn = state.elements[id] as ConnectorElement;
          const newConn = updated as ConnectorElement;
          
          if (oldConn.startElementId !== newConn.startElementId) {
            if (oldConn.startElementId && state.connectorsByElement[oldConn.startElementId]) {
              state.connectorsByElement[oldConn.startElementId] = state.connectorsByElement[oldConn.startElementId].filter(cid => cid !== id);
            }
            if (newConn.startElementId) {
              if (!state.connectorsByElement[newConn.startElementId]) state.connectorsByElement[newConn.startElementId] = [];
              if (!state.connectorsByElement[newConn.startElementId].includes(id)) state.connectorsByElement[newConn.startElementId].push(id);
            }
          }
          if (oldConn.endElementId !== newConn.endElementId) {
            if (oldConn.endElementId && state.connectorsByElement[oldConn.endElementId]) {
              state.connectorsByElement[oldConn.endElementId] = state.connectorsByElement[oldConn.endElementId].filter(cid => cid !== id);
            }
            if (newConn.endElementId) {
              if (!state.connectorsByElement[newConn.endElementId]) state.connectorsByElement[newConn.endElementId] = [];
              if (!state.connectorsByElement[newConn.endElementId].includes(id)) state.connectorsByElement[newConn.endElementId].push(id);
            }
          }
        }`;
const newUpdateElementConnectorLogic = `        // Handle connector specific changes
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
        }`;
content = content.replace(oldUpdateElementConnectorLogic, newUpdateElementConnectorLogic);

// 6. Fix deleteElements
const oldDeleteElementsConnectorLogic = `        const el = state.elements[id];
        if (el?.type === ShapeType.CONNECTOR) {
          const conn = el as ConnectorElement;
          if (conn.startElementId && state.connectorsByElement[conn.startElementId]) {
            state.connectorsByElement[conn.startElementId] = state.connectorsByElement[conn.startElementId].filter(cid => cid !== id);
          }
          if (conn.endElementId && state.connectorsByElement[conn.endElementId]) {
            state.connectorsByElement[conn.endElementId] = state.connectorsByElement[conn.endElementId].filter(cid => cid !== id);
          }
        }`;
const newDeleteElementsConnectorLogic = `        const el = state.elements[id];
        if (el?.type === ShapeType.CONNECTOR) {
          const conn = el as ConnectorElement;
          if (conn.startElementId && state.connectorsByElement.has(conn.startElementId)) {
            state.connectorsByElement.get(conn.startElementId)!.delete(id);
          }
          if (conn.endElementId && state.connectorsByElement.has(conn.endElementId)) {
            state.connectorsByElement.get(conn.endElementId)!.delete(id);
          }
        }`;
content = content.replace(oldDeleteElementsConnectorLogic, newDeleteElementsConnectorLogic);

// 7. Fix batchErase
const oldBatchEraseConnectorLogic = `        const el = state.elements[id];
        if (el?.type === ShapeType.CONNECTOR) {
          const conn = el as ConnectorElement;
          if (conn.startElementId && state.connectorsByElement[conn.startElementId]) {
            state.connectorsByElement[conn.startElementId] = state.connectorsByElement[conn.startElementId].filter(cid => cid !== id);
          }
          if (conn.endElementId && state.connectorsByElement[conn.endElementId]) {
            state.connectorsByElement[conn.endElementId] = state.connectorsByElement[conn.endElementId].filter(cid => cid !== id);
          }
        }`;
const newBatchEraseConnectorLogic = `        const el = state.elements[id];
        if (el?.type === ShapeType.CONNECTOR) {
          const conn = el as ConnectorElement;
          if (conn.startElementId && state.connectorsByElement.has(conn.startElementId)) {
            state.connectorsByElement.get(conn.startElementId)!.delete(id);
          }
          if (conn.endElementId && state.connectorsByElement.has(conn.endElementId)) {
            state.connectorsByElement.get(conn.endElementId)!.delete(id);
          }
        }`;
content = content.replace(oldBatchEraseConnectorLogic, newBatchEraseConnectorLogic);

// 8. Fix updateAttachedConnectors
const oldUpdateAttachedConnectors = `    updateAttachedConnectors: (elementId, recalculatePath) => set((state) => {
      const connIds = state.connectorsByElement[elementId];
      if (!connIds || connIds.length === 0) return;
      
      connIds.forEach(connId => {
        const connector = state.elements[connId] as ConnectorElement;
        if (!connector || connector.isManuallyRouted) return; // Don't auto-route if manually routed
        
        // Pass to the callback to calculate positions and control points
        recalculatePath(connector, state.elements);
      });
    }),`;
const newUpdateAttachedConnectors = `    updateAttachedConnectors: (movedElementIds, elementsMap) => set((state) => {
      const visited = new Set<string>();
      const manager = new ConnectorManager();
      
      const processElement = (elementId: string) => {
        if (visited.has(elementId)) return;
        visited.add(elementId);

        const connectorIds = state.connectorsByElement.get(elementId);
        if (!connectorIds) return;

        for (const connectorId of connectorIds) {
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
    }),`;
content = content.replace(oldUpdateAttachedConnectors, newUpdateAttachedConnectors);

// 9. Fix detachConnectorsFromElement
const oldDetachConnectors = `    detachConnectorsFromElement: (elementId) => set((state) => {
      const connIds = state.connectorsByElement[elementId];
      if (!connIds) return;
      
      connIds.forEach(connId => {
        const conn = state.elements[connId] as ConnectorElement;
        if (!conn) return;
        
        if (conn.startElementId === elementId) {
          conn.startElementId = null;
        }
        if (conn.endElementId === elementId) {
          conn.endElementId = null;
        }
      });
      
      state.connectorsByElement[elementId] = [];
    }),`;
const newDetachConnectors = `    detachConnectorsFromElement: (elementId) => set((state) => {
      const connIds = state.connectorsByElement.get(elementId);
      if (!connIds) return;
      
      const manager = new ConnectorManager();
      // To get live positions we need a Map
      const elementsMap = new Map(Object.entries(state.elements));

      for (const connId of connIds) {
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
    }),`;
content = content.replace(oldDetachConnectors, newDetachConnectors);

fs.writeFileSync(file, content, 'utf8');
console.log('Refactored canvas-store.ts');
