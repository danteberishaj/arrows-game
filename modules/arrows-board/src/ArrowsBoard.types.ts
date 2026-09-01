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
} & ViewProps;
