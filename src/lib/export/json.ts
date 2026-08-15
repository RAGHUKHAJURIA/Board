import { WhiteboardElement } from '@/types';

/**
 * Scene files.
 *
 * The envelope mirrors Excalidraw's (`type`/`version`/`elements`/`appState`) so
 * a file saved here is recognisable to that ecosystem and, more usefully, so an
 * `.excalidraw` file dropped in here loads instead of being rejected outright.
 * The element schemas differ, so this is interchange of the scene wrapper, not
 * a promise that every Excalidraw element type survives the trip.
 */

const FILE_TYPE = 'excalidraw';
const FILE_VERSION = 2;

interface SceneFile {
  type: string;
  version: number;
  source: string;
  elements: WhiteboardElement[];
  appState: { viewBackgroundColor: string };
}

export const exportToJSON = (
  elements: Record<string, WhiteboardElement>,
  background: string = 'transparent'
) => {
  const scene: SceneFile = {
    type: FILE_TYPE,
    version: FILE_VERSION,
    source: 'drawer',
    elements: Object.values(elements),
    appState: { viewBackgroundColor: background },
  };

  const blob = new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `drawer-${new Date().toISOString().split('T')[0]}.excalidraw`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Open the file picker and parse the chosen scene, or null if cancelled.
 * The input element is created on demand so this works from anywhere —
 * the menu item and the Ctrl+O handler both just call it.
 */
export const pickAndParseScene = async (): Promise<
  { elements: WhiteboardElement[]; background: string } | null
> => {
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.excalidraw,.json,.drawer,application/json';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
  if (!file) return null;

  try {
    return await importFromJSON(file);
  } catch (err) {
    console.error('Failed to read scene file', err);
    return null;
  }
};

export const importFromJSON = async (
  file: File
): Promise<{ elements: WhiteboardElement[]; background: string }> => {
  const text = await file.text();
  const parsed = JSON.parse(text);

  // Accept a bare array, this app's old {elements, background} shape, and the
  // Excalidraw envelope where the colour lives under appState.
  if (Array.isArray(parsed)) {
    return { elements: parsed, background: 'transparent' };
  }

  const background =
    parsed.appState?.viewBackgroundColor ?? parsed.background ?? 'transparent';

  return { elements: parsed.elements ?? [], background };
};
