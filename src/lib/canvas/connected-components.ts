import { WhiteboardElement, ShapeType, ConnectorElement } from '@/types';
import { getElementBBox } from '@/lib/utils/geometry';

/**
 * Build adjacency graph of connected elements
 * Elements are "connected" if:
 * 1. They are physically touching (bounding boxes overlap)
 * 2. They are connected by a connector/arrow
 */
export function buildConnectionGraph(
  elements: Record<string, WhiteboardElement>
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  const elementArray = Object.values(elements);

  // Initialize graph
  elementArray.forEach(el => {
    graph.set(el.id, new Set<string>());
  });

  // Check for explicit connector connections
  elementArray.forEach(el => {
    if (el.type === ShapeType.CONNECTOR) {
      const conn = el as ConnectorElement;
      if (conn.startElementId && graph.has(conn.startElementId)) {
        graph.get(el.id)!.add(conn.startElementId);
        graph.get(conn.startElementId)!.add(el.id);
      }
      if (conn.endElementId && graph.has(conn.endElementId)) {
        graph.get(el.id)!.add(conn.endElementId);
        graph.get(conn.endElementId)!.add(el.id);
      }
    }
  });

  // Check for physical overlap (bounding box intersection)
  for (let i = 0; i < elementArray.length; i++) {
    for (let j = i + 1; j < elementArray.length; j++) {
      const el1 = elementArray[i];
      const el2 = elementArray[j];

      if (boundingBoxesOverlap(el1, el2)) {
        graph.get(el1.id)!.add(el2.id);
        graph.get(el2.id)!.add(el1.id);
      }
    }
  }

  return graph;
}

/**
 * Check if two element bounding boxes overlap
 */
function boundingBoxesOverlap(
  el1: WhiteboardElement,
  el2: WhiteboardElement
): boolean {
  const bbox1 = el1.bbox || getElementBBox(el1);
  const bbox2 = el2.bbox || getElementBBox(el2);

  return !(
    bbox1.maxX < bbox2.minX ||
    bbox1.minX > bbox2.maxX ||
    bbox1.maxY < bbox2.minY ||
    bbox1.minY > bbox2.maxY
  );
}

/**
 * Find connected component containing the given element ID
 * Uses BFS (Breadth-First Search)
 */
export function findConnectedComponent(
  elementId: string,
  graph: Map<string, Set<string>>
): Set<string> {
  const component = new Set<string>();
  const queue: string[] = [elementId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (visited.has(current)) continue;
    visited.add(current);
    component.add(current);

    const neighbors = graph.get(current);
    if (neighbors) {
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      });
    }
  }

  return component;
}
