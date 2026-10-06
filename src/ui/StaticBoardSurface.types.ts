import type { SharedValue } from 'react-native-reanimated';
import type { SlitherPath } from './arrowGeometry';
import type { BoardGrid } from './boardGrid';
import type { NativeExitAnimation } from './nativeExitAnimation';

export interface AnimatedArrowArt {
  id: number;
  /** Present only for the Android procedural interaction renderer. */
  nativeIndex?: number;
  shaftD: string;
  headD: string;
}

/** An arrow that moves along its own exit direction (the blocked bump). */
export interface BumpingArrowArt extends AnimatedArrowArt {
  /** Unit exit direction in board space (y down). */
  x: number;
  y: number;
  /** POLISH-T5 (R6a): end colour of the heart mix when the arrow is marked; absent = ink. */
  settle?: string;
  /**
   * POLISH-T6 (native): background colour painted, unmoved, over the arrow's
   * static twin under the bump. The retained board keeps drawing the arrow
   * (no hide/show hand-off between the two render pipelines); this covers it.
   */
  cover?: string;
}

/** W5-17: the cleared board's outline (board space), shown after `delayMs` and kept until the board is replaced. */
export interface ClearRevealArt {
  id: number;
  /** silhouette.ts `maskOutlinePath(mask, CELL)`: closed loops on the cell boundaries. */
  pathD: string;
  /** From the clearing tap (`atMs`) to the start of its fade-in: the exit's visible time + the empty-board hold. */
  delayMs: number;
  /** Date.now() at the clearing tap: the fade starts on that clock, not when React gets round to mounting it. */
  atMs: number;
  color: string;
  /** Board units; drawn at least CLEAR_REVEAL_MIN_STROKE_PT on screen. */
  strokeWidth: number;
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
  skinGeometry?: string;
  /** One character per initial arrow: `1` draws it and `0` hides it. */
  nativeVisibilityMask: string;
  background: string;
  ink: string;
  accent: string;
  heart: string;
  cellSize: number;
  /** Opening camera scale, known before the procedural native view is mounted. */
  initialCameraScale?: number;
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
  /** POLISH-T5 web: batched marked arrows (empty when none), drawn in `markColor`. */
  markShaftD: string;
  markHeadD: string;
  /** POLISH-T5 native: one character per initial arrow, `1` = marked; '' = none. */
  nativeMarkMask: string;
  /** Opaque deep-rose missed-mark colour (missedMarks.ts). */
  markColor: string;
  /** W5-17 (ART_CLEAR_REVEAL_ENABLED): the cleared board's outline; null or absent = none. */
  clearReveal?: ClearRevealArt | null;
}
