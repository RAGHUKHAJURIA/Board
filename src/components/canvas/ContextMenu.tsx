'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '@/store/canvas-store';
import { useUIStore } from '@/store/ui-store';

export interface ContextMenuState {
  /** Screen coordinates of the click. */
  x: number;
  y: number;
  /** Element under the cursor, if any — decides which items are shown. */
  elementId: string | null;
}

interface Item {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

const SEPARATOR = null;
type Row = Item | typeof SEPARATOR;

export function ContextMenu({
  state,
  onClose,
  onPasteAt,
}: {
  state: ContextMenuState;
  onClose: () => void;
  /** Paste is positional, so the canvas owns it. */
  onPasteAt: (screenX: number, screenY: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: state.x, y: state.y });

  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const elements = useCanvasStore((s) => s.elements);
  const grid = useUIStore((s) => s.grid);
  const updateGrid = useUIStore((s) => s.updateGrid);

  // Keep the menu on screen when opened near an edge.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      x: Math.min(state.x, window.innerWidth - width - 8),
      y: Math.min(state.y, window.innerHeight - height - 8),
    });
  }, [state.x, state.y]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // Capture phase: the canvas swallows pointerdown for drawing.
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const store = useCanvasStore.getState;
  const run = (fn: () => void) => () => { fn(); onClose(); };

  const hasSelection = selectedIds.size > 0;
  const selected = Array.from(selectedIds).map((id) => elements[id]).filter(Boolean);
  const allLocked = selected.length > 0 && selected.every((el) => el!.locked);
  const canGroup = selectedIds.size > 1;
  const canUngroup = selected.some((el) => (el!.groupIds?.length ?? 0) > 0);

  const selectionRows: Row[] = [
    { label: 'Cut', shortcut: 'Ctrl+X', onClick: run(() => { store().copy(); store().deleteElements(Array.from(store().selectedIds)); }) },
    { label: 'Copy', shortcut: 'Ctrl+C', onClick: run(() => store().copy()) },
    { label: 'Paste', shortcut: 'Ctrl+V', onClick: run(() => onPasteAt(state.x, state.y)) },
    SEPARATOR,
    { label: 'Copy styles', shortcut: 'Ctrl+Alt+C', onClick: run(() => store().copyStyle()) },
    { label: 'Paste styles', shortcut: 'Ctrl+Alt+V', onClick: run(() => store().pasteStyle()), disabled: !store().styleClipboard },
    SEPARATOR,
    { label: 'Duplicate', shortcut: 'Ctrl+D', onClick: run(() => store().duplicate()) },
    { label: canGroup ? 'Group selection' : 'Group selection', shortcut: 'Ctrl+G', onClick: run(() => store().groupSelected()), disabled: !canGroup },
    { label: 'Ungroup selection', shortcut: 'Ctrl+Shift+G', onClick: run(() => store().ungroupSelected()), disabled: !canUngroup },
    SEPARATOR,
    { label: 'Flip horizontal', shortcut: 'Shift+H', onClick: run(() => store().flipSelected('horizontal')) },
    { label: 'Flip vertical', shortcut: 'Shift+V', onClick: run(() => store().flipSelected('vertical')) },
    SEPARATOR,
    { label: 'Bring to front', shortcut: 'Ctrl+]', onClick: run(() => Array.from(store().selectedIds).forEach((id) => store().bringToFront(id))) },
    { label: 'Bring forward', onClick: run(() => Array.from(store().selectedIds).forEach((id) => store().bringForward(id))) },
    { label: 'Send backward', onClick: run(() => Array.from(store().selectedIds).forEach((id) => store().sendBackward(id))) },
    { label: 'Send to back', shortcut: 'Ctrl+[', onClick: run(() => Array.from(store().selectedIds).forEach((id) => store().sendToBack(id))) },
    SEPARATOR,
    { label: allLocked ? 'Unlock' : 'Lock', shortcut: 'Ctrl+Shift+L', onClick: run(() => store().toggleLockSelected()) },
    { label: 'Delete', shortcut: 'Del', onClick: run(() => store().deleteElements(Array.from(store().selectedIds))), destructive: true },
  ];

  const canvasRows: Row[] = [
    { label: 'Paste', shortcut: 'Ctrl+V', onClick: run(() => onPasteAt(state.x, state.y)) },
    { label: 'Select all', shortcut: 'Ctrl+A', onClick: run(() => store().selectAll()) },
    SEPARATOR,
    { label: grid.enabled ? 'Hide grid' : 'Show grid', shortcut: "Ctrl+'", onClick: run(() => updateGrid({ enabled: !grid.enabled })) },
    { label: 'Zoom to fit', shortcut: 'Shift+1', onClick: run(() => store().zoomToFit()) },
    { label: 'Reset zoom', shortcut: 'Ctrl+0', onClick: run(() => store().setZoom(1)) },
  ];

  const rows = hasSelection ? selectionRows : canvasRows;

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[500] min-w-[220px] py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1a1a1e] shadow-2xl text-foreground select-none"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {rows.map((row, i) =>
        row === SEPARATOR ? (
          <div key={i} className="h-px my-1 bg-zinc-200 dark:bg-zinc-800" />
        ) : (
          <button
            key={i}
            disabled={row.disabled}
            onClick={row.onClick}
            className={`flex w-full items-center justify-between gap-6 px-3 py-1.5 text-[13px] transition-colors ${
              row.disabled
                ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                : row.destructive
                  ? 'text-red-500 hover:bg-red-500/10'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <span>{row.label}</span>
            {row.shortcut && (
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{row.shortcut}</span>
            )}
          </button>
        )
      )}
    </div>,
    document.body
  );
}
