import { BOARD_WRAPPER_OVERFLOW, boardWrapperOverflow } from '../boardOverflow';

describe('boardWrapperOverflow (POLISH-T1)', () => {
  it('clips to the board, exactly as before, while every board-polish flag is off', () => {
    expect(boardWrapperOverflow({ exitToScreenEdge: false, boardGrid: false })).toBe('hidden');
  });

  it('lets the native board paint beyond its bounds when either flag needs it', () => {
    expect(boardWrapperOverflow({ exitToScreenEdge: true, boardGrid: false })).toBe('visible');
    expect(boardWrapperOverflow({ exitToScreenEdge: false, boardGrid: true })).toBe('visible');
    expect(boardWrapperOverflow({ exitToScreenEdge: true, boardGrid: true })).toBe('visible');
  });

  it('defaults to hidden in a build without the flag env vars', () => {
    // jest runs without EXPO_PUBLIC_META_EXIT_TO_SCREEN_EDGE / EXPO_PUBLIC_META_BOARD_GRID.
    expect(process.env.EXPO_PUBLIC_META_EXIT_TO_SCREEN_EDGE).toBeUndefined();
    expect(process.env.EXPO_PUBLIC_META_BOARD_GRID).toBeUndefined();
    expect(BOARD_WRAPPER_OVERFLOW).toBe('hidden');
  });
});
