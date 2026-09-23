import { META_BOARD_GRID, META_EXIT_TO_SCREEN_EDGE } from '../featureFlags';

/**
 * POLISH-T1: whether the Android board wrapper (StaticBoardSurface.native.tsx)
 * clips the retained native board to the board rectangle. Proven on the API 31
 * emulator (docs/next-level/reports/POLISH-T1.md): with the wrapper's overflow
 * visible, ArrowsBoardView.onDraw paints beyond its own bounds and the painting
 * follows the pan/zoom transform; the BoardView viewport still clips at the
 * screen. Every flag off keeps today's clip.
 */
export function boardWrapperOverflow(flags: {
  exitToScreenEdge: boolean;
  boardGrid: boolean;
}): 'hidden' | 'visible' {
  return flags.exitToScreenEdge || flags.boardGrid ? 'visible' : 'hidden';
}

export const BOARD_WRAPPER_OVERFLOW = boardWrapperOverflow({
  exitToScreenEdge: META_EXIT_TO_SCREEN_EDGE,
  boardGrid: META_BOARD_GRID,
});
