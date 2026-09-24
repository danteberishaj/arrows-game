import type { ViewProps } from 'react-native';

export type ArrowsBoardViewProps = {
  /** Immutable semicolon/comma geometry payload parsed once per mission. */
  geometry: string;
  /** One character per arrow: `1` is visible and every other value is hidden. */
  visibleMask: string;
  /** Native stroke/fill color in #RRGGBB form. */
  ink: string;
  strokeWidth: number;
  /** Latest dense-board exit event: id,index,durationMs,reducedMotionFlag. */
  exitAnimation: string;
  /**
   * POLISH-T4 (META_BOARD_GRID, Android only): `cell,minCol,minRow,maxCol,maxRow,#dot,#line`.
   * Omitted entirely while the flag is off. The iOS view does not read it (R7).
   */
  grid?: string;
  /** POLISH-T4: `dotRadius,lineWidth,lines(0|1)` in board points; omitted while the flag is off. */
  gridStyle?: string;
  /**
   * POLISH-T5 (META_MISSED_MARK, Android only): one character per arrow, `1` draws a
   * visible arrow in `markColor` instead of `ink`; '' = no marks. Omitted while the flag is off.
   */
  markMask?: string;
  /** POLISH-T5: opaque missed-mark colour in #RRGGBB form; omitted while the flag is off. */
  markColor?: string;
} & ViewProps;
