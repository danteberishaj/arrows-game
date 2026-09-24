import { LevelGenerator } from '../../core';
import type { ArrowPath } from '../../core';
import { BoardArrowArtCache } from '../arrowGeometry';
import { audit, contrastRatio, relativeLuminance } from '../contrastAudit';
import {
  NO_MARKS,
  marksAfterBlockedTap,
  marksAfterRemoval,
  missedMarkColor,
  missedMarkMask,
  nativeMissedMarkProps,
  settleColor,
} from '../missedMarks';
import { blockedTapCost, BlockedTapLedger, type BlockedTapMode } from '../tapRules';
import { Daylight, InkNight } from '../theme';

const level = LevelGenerator.generate(0);
const arrows = level.board.arrows();
const [a, b, c] = arrows;

/**
 * Plays one blocked tap through the same chain BoardView + GameScreen use:
 * ledger -> blockedTapCost -> marksAfterBlockedTap with the FINAL chargeHeart.
 */
function tap(
  marks: ReadonlySet<ArrowPath>,
  ledger: BlockedTapLedger,
  arrow: ArrowPath,
  mode: BlockedTapMode,
  state: { graceAvailable: boolean; removalsThisBoard: number },
): { marks: ReadonlySet<ArrowPath>; charged: boolean } {
  const cost = blockedTapCost({
    ledgerCharge: ledger.charge(arrow),
    mode,
    graceAvailable: state.graceAvailable,
    removalsThisBoard: state.removalsThisBoard,
  });
  if (cost.consumeGrace) state.graceAvailable = false;
  return { marks: marksAfterBlockedTap(marks, arrow, cost.chargeHeart), charged: cost.chargeHeart };
}

describe('missed-mark colour (design spec C)', () => {
  test('deep rose: heart at 0.75 over the darker of ink/bg, the spec hexes', () => {
    expect(missedMarkColor(Daylight)).toBe('#B12B67');
    expect(missedMarkColor(InkNight)).toBe('#B93970');
  });

  test('meets 3:1 on bg in both themes and is darker than the flash', () => {
    for (const p of [Daylight, InkNight]) {
      const mark = missedMarkColor(p);
      expect(contrastRatio(mark, p.bg)).toBeGreaterThanOrEqual(3);
      expect(relativeLuminance(mark)).toBeLessThan(relativeLuminance(p.heart));
    }
  });

  test('the audit row arrow-missed-mark gates it at 6.16 / 3.45', () => {
    const rows = audit().filter((r) => r.usage.id === 'arrow-missed-mark');
    expect(rows.map((r) => [r.palette, r.fg, Number(r.ratio.toFixed(2)), r.gate, r.pass])).toEqual([
      ['Daylight', '#B12B67', 6.16, 3, true],
      ['Ink Night', '#B93970', 3.45, 3, true],
    ]);
  });

  test('the blocked bump settles to the mark only for a marked arrow', () => {
    const marks = marksAfterBlockedTap(NO_MARKS, a, true);
    expect(settleColor(Daylight, marks, a)).toBe('#B12B67');
    expect(settleColor(Daylight, marks, b)).toBe(Daylight.ink);
    expect(settleColor(InkNight, NO_MARKS, a)).toBe(InkNight.ink);
  });
});

describe('which blocked taps mark an arrow', () => {
  test('a normal blocked tap that charges a heart marks the arrow', () => {
    const ledger = new BlockedTapLedger();
    const r = tap(NO_MARKS, ledger, a, 'normal', { graceAvailable: false, removalsThisBoard: 0 });
    expect(r.charged).toBe(true);
    expect(r.marks.has(a)).toBe(true);
    expect(r.marks.size).toBe(1);
  });

  test('re-tapping a marked arrow is free and keeps the mark (same set reference)', () => {
    const ledger = new BlockedTapLedger();
    const first = tap(NO_MARKS, ledger, a, 'normal', { graceAvailable: false, removalsThisBoard: 0 });
    const again = tap(first.marks, ledger, a, 'normal', { graceAvailable: false, removalsThisBoard: 0 });
    expect(again.charged).toBe(false);
    expect(again.marks).toBe(first.marks);
    expect(again.marks.has(a)).toBe(true);
  });

  test('the tutorial-grace tap is forgiven and does NOT mark, and can never mark later', () => {
    const ledger = new BlockedTapLedger();
    const state = { graceAvailable: true, removalsThisBoard: 0 };
    const graced = tap(NO_MARKS, ledger, a, 'tutorialGrace', state);
    expect(graced.charged).toBe(false);
    expect(graced.marks).toBe(NO_MARKS);
    // The ledger already recorded it, so a re-tap is free and still unmarked.
    const retap = tap(graced.marks, ledger, a, 'tutorialGrace', state);
    expect(retap.charged).toBe(false);
    expect(retap.marks.has(a)).toBe(false);
    // Grace is spent: a different fresh blocked arrow now costs and marks.
    const next = tap(retap.marks, ledger, b, 'tutorialGrace', state);
    expect(next.charged).toBe(true);
    expect([...next.marks]).toEqual([b]);
  });

  test('an assist tap before the first removal is forgiven and does NOT mark', () => {
    const ledger = new BlockedTapLedger();
    const state = { graceAvailable: false, removalsThisBoard: 0 };
    const assisted = tap(NO_MARKS, ledger, a, 'assist', state);
    expect(assisted.charged).toBe(false);
    expect(assisted.marks).toBe(NO_MARKS);
    state.removalsThisBoard = 1;
    const after = tap(assisted.marks, ledger, c, 'assist', state);
    expect(after.charged).toBe(true);
    expect([...after.marks]).toEqual([c]);
  });

  test('several charged arrows are all marked', () => {
    let marks = marksAfterBlockedTap(NO_MARKS, a, true);
    marks = marksAfterBlockedTap(marks, b, true);
    expect(marks.has(a) && marks.has(b)).toBe(true);
    expect(NO_MARKS.size).toBe(0);
  });
});

describe('clearing marks', () => {
  test('removing a marked arrow clears only its mark', () => {
    let marks = marksAfterBlockedTap(NO_MARKS, a, true);
    marks = marksAfterBlockedTap(marks, b, true);
    const after = marksAfterRemoval(marks, a);
    expect(after.has(a)).toBe(false);
    expect(after.has(b)).toBe(true);
    expect(marks.has(a)).toBe(true); // immutable: the old set is untouched
  });

  test('removing an unmarked arrow keeps the same set reference (no mask rebuild)', () => {
    const marks = marksAfterBlockedTap(NO_MARKS, a, true);
    expect(marksAfterRemoval(marks, b)).toBe(marks);
    expect(marksAfterRemoval(NO_MARKS, b)).toBe(NO_MARKS);
  });

  test('a new level or a restart starts from NO_MARKS (the ledger resets with it)', () => {
    const ledger = new BlockedTapLedger();
    const first = tap(NO_MARKS, ledger, a, 'normal', { graceAvailable: false, removalsThisBoard: 0 });
    expect(first.marks.size).toBe(1);
    ledger.reset();
    const restarted = tap(NO_MARKS, ledger, b, 'normal', { graceAvailable: false, removalsThisBoard: 0 });
    expect([...restarted.marks]).toEqual([b]);
  });
});

describe('native mark mask and props', () => {
  const cache = new BoardArrowArtCache(arrows, 40);

  test('one character per initial arrow, 1 where marked', () => {
    const marks = marksAfterBlockedTap(marksAfterBlockedTap(NO_MARKS, b, true), c, true);
    const mask = missedMarkMask(cache, marks);
    expect(mask).toHaveLength(arrows.length);
    expect(mask.slice(0, 3)).toBe('011');
    expect(mask.replace(/0/g, '')).toBe('11');
  });

  test('no marks is the empty string, so an unmarked level never rebuilds', () => {
    expect(missedMarkMask(cache, NO_MARKS)).toBe('');
  });

  test('flag OFF spreads nothing: the native props object is byte-identical', () => {
    const today = { geometry: 'g', visibleMask: '101', ink: '#191724', strokeWidth: 5.76, exitAnimation: '' };
    const props = nativeMissedMarkProps('011', '#B12B67', false);
    expect(props).toEqual({});
    expect(JSON.stringify({ ...today, ...props })).toBe(JSON.stringify(today));
  });

  test('flag ON passes the mask and the opaque mark colour', () => {
    expect(nativeMissedMarkProps('011', '#B12B67', true)).toEqual({ markMask: '011', markColor: '#B12B67' });
    expect(nativeMissedMarkProps('', '#B93970', true)).toEqual({ markMask: '', markColor: '#B93970' });
  });
});
