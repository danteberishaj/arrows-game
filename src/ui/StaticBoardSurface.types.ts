import type { SharedValue } from 'react-native-reanimated';
import type { SlitherPath } from './arrowGeometry';
import type { BoardGrid } from './boardGrid';
import type { NativeExitAnimation } from './nativeExitAnimation';

export interface AnimatedArrowArt {
  id: number;
  shaftD: string;
  headD: string;
}

/** An arrow that moves along its own exit direction (the blocked bump). */
export interface BumpingArrowArt extends AnimatedArrowArt {
  /** Unit exit direction in board space (y down). */
  x: number;
  y: number;
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
  shaking: BumpingArrowArt | null;
  /** The arrow in a blocked arrow's lane, flashing in the fail colour. */
  blocker: AnimatedArrowArt | null;
  /** The arrow under the finger, previewed from touch-down to release. */
  pressed: AnimatedArrowArt | null;
  hint: AnimatedArrowArt | null;
  exiting: (AnimatedExitTrail | null)[];
  nativeExitAnimation: NativeExitAnimation | null;
  reducedMotion: boolean;
  /** POLISH-T4 dot grid (and "#" lines), under the arrows; null = none. */
  grid: BoardGrid | null;
}
