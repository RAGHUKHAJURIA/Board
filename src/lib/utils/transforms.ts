
export enum ResizeHandle {
  NW = 'nw',
  N = 'n',
  NE = 'ne',
  E = 'e',
  SE = 'se',
  S = 's',
  SW = 'sw',
  W = 'w',
  ROTATION = 'rotation'
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getResizeHandleCursor = (handle: ResizeHandle, _elementRotation: number): string => {
  // A simple mapping for cursor styles. 
  // For proper handling factoring in rotation, we'd adjust the cursor angles.
  // For now we map to standard cursors.
  const cursorMap: Record<ResizeHandle, string> = {
    [ResizeHandle.NW]: 'nwse-resize',
    [ResizeHandle.N]: 'ns-resize',
    [ResizeHandle.NE]: 'nesw-resize',
    [ResizeHandle.E]: 'ew-resize',
    [ResizeHandle.SE]: 'nwse-resize',
    [ResizeHandle.S]: 'ns-resize',
    [ResizeHandle.SW]: 'nesw-resize',
    [ResizeHandle.W]: 'ew-resize',
    [ResizeHandle.ROTATION]: 'grab'
  };
  return cursorMap[handle];
};

export const snapToGrid = (value: number, gridSize: number, enabled: boolean): number => {
  if (!enabled) return value;
  return Math.round(value / gridSize) * gridSize;
};

// Calculates the new bounds when resizing an element
export const resizeElement = (
  handle: ResizeHandle,
  x: number,
  y: number,
  width: number,
  height: number,
  deltaX: number,
  deltaY: number,
  preserveAspectRatio: boolean
): { x: number, y: number, width: number, height: number } => {
  let nx = x;
  let ny = y;
  let nw = width;
  let nh = height;

  if (handle.includes('w')) {
    nw -= deltaX;
    nx += deltaX;
  }
  if (handle.includes('e')) {
    nw += deltaX;
  }
  if (handle.includes('n')) {
    nh -= deltaY;
    ny += deltaY;
  }
  if (handle.includes('s')) {
    nh += deltaY;
  }

  // Handle negative widths/heights by flipping
  if (nw < 0) {
    nw = Math.abs(nw);
    nx -= nw;
  }
  if (nh < 0) {
    nh = Math.abs(nh);
    ny -= nh;
  }

  if (preserveAspectRatio) {
    const ratio = width / height;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      nh = nw / ratio;
    } else {
      nw = nh * ratio;
    }
  }

  return { x: nx, y: ny, width: Math.max(1, nw), height: Math.max(1, nh) };
};
