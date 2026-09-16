import { ArrowPath, BoardLogic, Direction } from '../../core';
import { BlockedTapLedger, GHOST_TAP_WINDOW_MS, isGhostTap } from '../tapRules';

const arrow = (r: number, c: number) => new ArrowPath([{ r, c }], Direction.Up);

describe('BlockedTapLedger', () => {
  it('charges each arrow once and everything again after reset', () => {
    const ledger = new BlockedTapLedger();
    const a = arrow(0, 0), b = arrow(0, 1);
    expect(ledger.charge(a)).toBe(true);
    expect(ledger.charge(a)).toBe(false);
    expect(ledger.isCharged(a)).toBe(true);
    expect(ledger.isCharged(b)).toBe(false);
    expect(ledger.charge(b)).toBe(true);
    expect(ledger.charge(a)).toBe(false);
    ledger.reset();
    expect(ledger.charge(a)).toBe(true);
  });
});

describe('isGhostTap', () => {
  const board = BoardLogic.parse(4, 4, ['0,2,R:L', '2,0,U:D']);
  const gone = board.ownerAt(0, 1)!;
  const staying = board.ownerAt(2, 0)!;

  it('drops a tap on the just-freed cells inside the window only', () => {
    expect(board.tryRemove(gone)).toBe(true);
    const recent = { arrow: gone, at: 1000 };
    expect(isGhostTap(board, recent, { r: 0, c: 1 }, 1000 + GHOST_TAP_WINDOW_MS)).toBe(true);
    expect(isGhostTap(board, recent, { r: 0, c: 2 }, 1100)).toBe(true);
    expect(isGhostTap(board, recent, { r: 0, c: 1 }, 1000 + GHOST_TAP_WINDOW_MS + 1)).toBe(false);
    expect(isGhostTap(board, recent, { r: 0, c: 1 }, 900)).toBe(false); // clock ran backwards
  });

  it('never drops a tap on a cell that is still owned or was never the removed arrow', () => {
    const recent = { arrow: gone, at: 1000 };
    expect(isGhostTap(board, recent, { r: 2, c: 0 }, 1010)).toBe(false);
    expect(isGhostTap(board, recent, { r: 3, c: 3 }, 1010)).toBe(false);
    expect(isGhostTap(board, null, { r: 0, c: 1 }, 1010)).toBe(false);
    expect(staying).toBeTruthy();
  });
});
