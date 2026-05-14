export type CanvasInputMode = 'pen' | 'hand';

export interface InputModeState {
  mode: CanvasInputMode;
  isTouchDevice: boolean;
  isTablet: boolean;
}
