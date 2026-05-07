const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'components', 'canvas', 'Canvas.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add connectorEndpointRef
if (!content.includes('connectorEndpointRef')) {
  content = content.replace(
    "const connectorHandleIndexRef = useRef<number | null>(null);",
    "const connectorHandleIndexRef = useRef<number | null>(null);\n  const connectorEndpointRef = useRef<'start' | 'end' | null>(null);"
  );
}

// 2. Add 'connector-endpoint-drag' to InteractionMode
if (!content.includes("'connector-endpoint-drag'")) {
  content = content.replace(
    "  | 'connector-reshaping';",
    "  | 'connector-reshaping'\n  | 'connector-endpoint-drag';"
  );
}

// 3. Pointer Down logic
const oldPointerDownConnectorCheck = `        if (el.type === ShapeType.CONNECTOR) {
          const manager = new ConnectorManager();
          const conn = el as ConnectorElement;
          const handleRad = 10 / viewport.zoom;
          const dist = (p1: Point, p2: Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

          const mid = manager.getPointOnCurve(0.5, conn.startX, conn.startY, conn.endX, conn.endY, conn.controlPoints);
          if (dist(world, mid) < handleRad) {
            connectorHandleIndexRef.current = -1;
            resizeElementIdRef.current = el.id;
            setMode('connector-reshaping');
            return;
          }`;
const newPointerDownConnectorCheck = `        if (el.type === ShapeType.CONNECTOR) {
          const manager = new ConnectorManager();
          const conn = el as ConnectorElement;
          const handleRad = 12 / viewport.zoom;
          const dist = (p1: Point, p2: Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

          const resolved = manager.resolveConnectorEndpoints(conn, useCanvasStore.getState().getElementsMap());

          if (dist(world, { x: resolved.endX, y: resolved.endY }) < handleRad) {
            connectorEndpointRef.current = 'end';
            resizeElementIdRef.current = el.id;
            setMode('connector-endpoint-drag');
            return;
          }
          if (dist(world, { x: resolved.startX, y: resolved.startY }) < handleRad) {
            connectorEndpointRef.current = 'start';
            resizeElementIdRef.current = el.id;
            setMode('connector-endpoint-drag');
            return;
          }

          const mid = manager.getPointOnCurve(0.5, resolved.startX, resolved.startY, resolved.endX, resolved.endY, conn.controlPoints);
          if (dist(world, mid) < handleRad) {
            connectorHandleIndexRef.current = -1;
            resizeElementIdRef.current = el.id;
            setMode('connector-reshaping');
            return;
          }`;
if (!content.includes("connectorEndpointRef.current = 'end';")) {
  content = content.replace(oldPointerDownConnectorCheck, newPointerDownConnectorCheck);
}

// 4. Pointer Move logic
const pointerMoveReshapingCase = `      case 'connector-reshaping': {`;
const newPointerMoveEndpointCase = `      case 'connector-endpoint-drag': {
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

      case 'connector-reshaping': {`;
if (!content.includes("case 'connector-endpoint-drag':")) {
  content = content.replace(pointerMoveReshapingCase, newPointerMoveEndpointCase);
}

// 5. Pointer Up logic
const oldPointerUpConnectorDraw = `    } else if (prevMode === 'connector-reshaping') {
      saveSnapshot();
      currentElementRef.current = null;
      resizeElementIdRef.current = null;
      connectorHandleIndexRef.current = null;
    }`;
const newPointerUpEndpointDrag = `    } else if (prevMode === 'connector-reshaping') {
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
          const anchorHit = manager.findNearestAnchor(world.x, world.y, store.elements, excludeId);
          
          const updates: Partial<ConnectorElement> = {};
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
          store.updateElement(elId, updates);
          
          // CRITICAL: sync the connectorsByElement index after rebinding
          store.syncConnectorIndex({ ...connector, ...updates } as ConnectorElement, 'update');
        }
      }
      
      store.setHoveredBindTarget(null);
      saveSnapshot();
      resizeElementIdRef.current = null;
      connectorEndpointRef.current = null;
    }`;
if (!content.includes("else if (prevMode === 'connector-endpoint-drag')")) {
  content = content.replace(oldPointerUpConnectorDraw, newPointerUpEndpointDrag);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Refactored Canvas.tsx for endpoint dragging');
