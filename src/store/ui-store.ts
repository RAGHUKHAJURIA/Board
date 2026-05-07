import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { GridSettings, SnapSettings, StyleProperties } from "@/types";
import { useCanvasStore } from "./canvas-store";


interface UIState {
  panels: {
    layers: boolean;
    properties: boolean;
    library: boolean;
  };
  grid: GridSettings;
  snap: SnapSettings;
  theme: "dark" | "light" | "system";
  currentStyle: StyleProperties;

  // Actions
  togglePanel: (panel: keyof UIState["panels"]) => void;
  updateGrid: (settings: Partial<GridSettings>) => void;
  updateSnap: (settings: Partial<SnapSettings>) => void;
  setTheme: (theme: "dark" | "light" | "system") => void;
  updateCurrentStyle: (style: Partial<StyleProperties>) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    immer((set) => ({
      panels: {
        layers: true,
        properties: true,
        library: false,
      },
      grid: {
        enabled: true,
        size: 20,
        type: "dots",
        color: "rgba(128, 128, 128, 0.2)",
        opacity: 1,
      },
      snap: {
        enabled: true,
        snapToGrid: true,
        snapToObjects: true,
        snapDistance: 5,
        showGuides: true,
      },
      theme: "dark",
      currentStyle: {
        fill: "transparent",
        stroke: "#e2e8f0", // slate-200
        strokeWidth: 2,
        opacity: 1,
        roughness: 1,
        strokeStyle: "solid",
        penType: "pen",
      },

      togglePanel: (panel) =>
        set((state) => {
          state.panels[panel] = !state.panels[panel];
        }),

      updateGrid: (settings) =>
        set((state) => {
          state.grid = { ...state.grid, ...settings };
        }),

      updateSnap: (settings) =>
        set((state) => {
          state.snap = { ...state.snap, ...settings };
        }),

      setTheme: (theme) => {
        // Resolve previous theme BEFORE updating state
        const currentState = useUIStore.getState();
        const previousResolvedTheme = currentState.theme === 'system'
          ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : currentState.theme;

        const resolvedTheme = theme === 'system'
          ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : theme;

        // Update UI state
        set((state) => {
          const LIGHT_STROKES = ['#e2e8f0', '#f8fafc', '#ffffff', '#d1d5db', '#e5e7eb'];
          const DARK_STROKES = ['#1e1e1e', '#000000', '#0f172a', '#1a1a2e'];
          
          // Automatically switch default stroke color for better visibility
          if (resolvedTheme === "light" && LIGHT_STROKES.includes(state.currentStyle.stroke)) {
            state.currentStyle.stroke = "#1e1e1e";
          } else if (resolvedTheme === "dark" && DARK_STROKES.includes(state.currentStyle.stroke)) {
            state.currentStyle.stroke = "#e2e8f0";
          }
          state.theme = theme;
        });

        // Synchronously update canvas store: ALWAYS reset background on theme switch
        const canvasStore = useCanvasStore.getState();
        const newBackground = resolvedTheme === 'dark' ? '#000000' : '#ffffff';
        canvasStore.setCanvasBackground(newBackground);
        canvasStore.setIsCanvasBackgroundCustomized(false);

        // Invert element colors only when the resolved theme actually changed
        if (previousResolvedTheme !== resolvedTheme) {
          canvasStore.invertElementColors(previousResolvedTheme, resolvedTheme);
        }
      },

      updateCurrentStyle: (style) =>
        set((state) => {
          state.currentStyle = { ...state.currentStyle, ...style };
        }),
    })),
    {
      name: 'drawer-ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        currentStyle: state.currentStyle,
      }),
    }
  ),
);
