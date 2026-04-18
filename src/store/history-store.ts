import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { HistoryEntry } from '@/types';

interface HistoryState {
  stack: HistoryEntry[];
  position: number;
  maxSize: number;
  
  record: (entry: HistoryEntry) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  immer((set, get) => ({
    stack: [],
    position: -1,
    maxSize: 100,
    
    record: (entry) => set((state) => {
      // If we are recording a new action after having undone some actions,
      // we need to discard the 'future' actions
      if (state.position < state.stack.length - 1) {
        state.stack = state.stack.slice(0, state.position + 1);
      }
      
      state.stack.push(entry);
      state.position++;
      
      if (state.stack.length > state.maxSize) {
        state.stack.shift();
        state.position--;
      }
    }),
    
    undo: () => {
      const { stack, position } = get();
      if (position >= 0) {
        const entry = stack[position];
        set((state) => {
          state.position--;
        });
        return entry || null;
      }
      return null;
    },
    
    redo: () => {
      const { stack, position } = get();
      if (position < stack.length - 1) {
        set((state) => {
          state.position++;
        });
        return stack[position + 1] || null;
      }
      return null;
    },
    
    canUndo: () => get().position >= 0,
    
    canRedo: () => get().position < get().stack.length - 1,
    
    clear: () => set((state) => {
      state.stack = [];
      state.position = -1;
    })
  }))
);
