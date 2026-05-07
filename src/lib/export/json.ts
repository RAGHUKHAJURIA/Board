import { WhiteboardElement } from '@/types';

export const exportToJSON = (elements: Record<string, WhiteboardElement>, background: string = 'transparent') => {
  const data = JSON.stringify({
    elements: Object.values(elements),
    background
  }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `whiteboard-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importFromJSON = async (file: File): Promise<{elements: WhiteboardElement[], background: string}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          resolve({ elements: parsed, background: 'transparent' });
        } else {
          resolve({ elements: parsed.elements || [], background: parsed.background || 'transparent' });
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};
