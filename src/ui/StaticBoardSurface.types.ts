import type { SharedValue } from 'react-native-reanimated';
import type { SlitherPath } from './arrowGeometry';
import type { NativeExitAnimation } from './nativeExitAnimation';

export interface AnimatedArrowArt {
  id: number;
  shaftD: string;
  headD: string;
}

export interface AnimatedExitTrail {
  id: number;
  path: SlitherPath;
  durationMs: number;
  reducedMotion: boolean;
}

export type { NativeExitAnimation } from './nativeExitAnimation';

export interface StaticBoardSurfaceProps {
  scale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  viewportW: number;
  viewportH: number;
  boardW: number;
  boardH: number;
  shaftD: string;
  headD: string;
  /** Immutable per-level geometry consumed only by the native board view. */
  nativeGeometry: string;
  /** One character per initial arrow: `1` draws it and `0` hides it. */
  nativeVisibilityMask: string;
  background: string;
  ink: string;
  accent: string;
  heart: string;
  cellSize: number;
  strokeWidth: number;
  shaking: AnimatedArrowArt | null;
  hint: AnimatedArrowArt | null;
  exiting: (AnimatedExitTrail | null)[];
  nativeExitAnimation: NativeExitAnimation | null;
}
