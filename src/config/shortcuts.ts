import { ShapeType } from '@/types';

export const SHORTCUTS = {
  // Tools
  SELECT: 'v',
  PEN: 'p',
  TEXT: 't',
  RECTANGLE: 'r',
  CIRCLE: 'o',
  LINE: 'l',
  ARROW: 'a',
  ERASER: 'e',
  HAND: 'h',

  // Actions
  UNDO: 'ctrl+z, meta+z',
  REDO: 'ctrl+y, meta+y, ctrl+shift+z, meta+shift+z',
  COPY: 'ctrl+c, meta+c',
  PASTE: 'ctrl+v, meta+v',
  CUT: 'ctrl+x, meta+x',
  DUPLICATE: 'ctrl+d, meta+d',
  DELETE: 'backspace, delete',
  SELECT_ALL: 'ctrl+a, meta+a',

  // View
  ZOOM_IN: 'ctrl+=, meta+=',
  ZOOM_OUT: 'ctrl+-, meta+-',
  ZOOM_RESET: 'ctrl+0, meta+0',

  // Arrange
  BRING_FRONT: 'ctrl+]',
  SEND_BACK: 'ctrl+[',
};

export const TOOL_SHORTCUT_MAP: Record<string, string> = {
  [SHORTCUTS.SELECT]: 'select',
  [SHORTCUTS.PEN]: ShapeType.FREEHAND,
  [SHORTCUTS.TEXT]: 'text',
  [SHORTCUTS.RECTANGLE]: ShapeType.RECTANGLE,
  [SHORTCUTS.CIRCLE]: ShapeType.ELLIPSE, // mapping 'o' to ellipse
  [SHORTCUTS.LINE]: ShapeType.LINE,
  [SHORTCUTS.ARROW]: ShapeType.ARROW,
  [SHORTCUTS.ERASER]: 'eraser',
  [SHORTCUTS.HAND]: 'hand',
};
