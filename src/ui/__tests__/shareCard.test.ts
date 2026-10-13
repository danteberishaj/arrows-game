/**
 * W4-13 (owner answer 2026-10-06, docs/owner-rulings-2026-10-06.md Q4: "yes, purple"): the daily share card's text.
 * Purple/white squares, the cleared shape cropped and fitted inside a 10 x 10 box, no store link, no personal data
 * beyond the streak the player chooses to send. Checked cell by cell against generateDaily(day).mask, not a golden.
 */
import { generateDaily, LevelGenerator, shapeNameForLevel } from '../../core';
import {
  buildDailyShareText,
  buildLevelShareText,
  dailyShareDate,
  SHARE_BOX,
  SHARE_CARD_MAX_LENGTH,
  SHARE_GLYPH_OFF,
  SHARE_GLYPH_ON,
  shareGrid,
} from '../shareCard';

const DAYS = Array.from({ length: 3650 }, (_, d) => d);

/** Independent reference: crop to the filled bounding box, then each output cell is the >= 50 % majority of its
 *  source block (W4-12's rule). Wide or square: 10 columns, rows = round(10 h / w); tall: 10 rows, columns = round(10 w / h). */
function reference(mask: readonly (readonly boolean[])[]): boolean[][] {
  let r0 = Infinity; let r1 = -1; let c0 = Infinity; let c1 = -1;
  mask.forEach((row, r) => row.forEach((v, c) => {
    if (v) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
  }));
  const src = mask.slice(r0, r1 + 1).map((row) => row.slice(c0, c1 + 1));
  const H = src.length; const W = src[0].length;
  const cols = W >= H ? Math.min(10, W) : Math.max(1, Math.round((Math.min(10, H) * W) / H));
  const rows = W >= H ? Math.max(1, Math.round((cols * H) / W)) : Math.min(10, H);
  const out: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    const rs = Math.floor((r * H) / rows); const re = Math.max(rs + 1, Math.floor(((r + 1) * H) / rows));
    const row: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      const cs = Math.floor((c * W) / cols); const ce = Math.max(cs + 1, Math.floor(((c + 1) * W) / cols));
      let filled = 0; let total = 0;
      for (let rr = rs; rr < re; rr++) for (let cc = cs; cc < ce; cc++) { total++; if (src[rr][cc]) filled++; }
      row.push(filled / total >= 0.5);
    }
    out.push(row);
  }
  return out;
}

const card = (day: number, extra: Partial<Parameters<typeof buildDailyShareText>[0]> = {}) => {
  const level = generateDaily(day);
  return buildDailyShareText({ day, mask: level.mask, shapeName: level.shapeName, heartsLeft: 3, maxHearts: level.hearts, streak: 7, ...extra });
};

describe('shareGrid: the mask cropped and fitted inside a 10 x 10 box', () => {
  it('matches the cropped >= 50 % downsample cell by cell for every daily of 10 years', () => {
    for (const day of DAYS) {
      const grid = shareGrid(generateDaily(day).mask);
      expect([day, grid]).toEqual([day, reference(generateDaily(day).mask)]);
    }
  });

  it('never exceeds 10 x 10, and every row has the same number of cells', () => {
    for (const day of DAYS) {
      const grid = shareGrid(generateDaily(day).mask);
      expect(grid.length).toBeLessThanOrEqual(SHARE_BOX);
      expect(grid.length).toBeGreaterThan(0);
      for (const row of grid) {
        expect(row.length).toBe(grid[0].length);
        expect(row.length).toBeLessThanOrEqual(SHARE_BOX);
      }
    }
  });

  it('the tall worst case (Bolt) is 10 rows, narrower than 10, and still shows the shape', () => {
    const boltDays = DAYS.filter((d) => generateDaily(d).shapeName === 'Bolt');
    expect(boltDays.length).toBeGreaterThan(0);
    for (const day of boltDays.slice(0, 20)) {
      const grid = shareGrid(generateDaily(day).mask);
      expect(grid.length).toBe(10);
      expect(grid[0].length).toBeLessThan(10);
      expect(grid.flat().filter(Boolean).length).toBeGreaterThan(0);
    }
  });

  it('an empty mask gives an empty grid', () => {
    expect(shareGrid([])).toEqual([]);
    expect(shareGrid([[false, false]])).toEqual([]);
  });
});

describe('buildDailyShareText', () => {
  it('reads like the owner-approved mock-up: header lines, a blank line, then purple/white rows', () => {
    const level = generateDaily(2470);
    const text = card(2470);
    const lines = text.split('\n');
    expect(lines.slice(0, 5)).toEqual([`Arrows · ${dailyShareDate(2470)}`, level.shapeName, `Hearts left: 3/${level.hearts}`, 'Day streak: 7', '']);
    expect(dailyShareDate(2470)).toBe('2026-10-06');
    expect(level.shapeName).toBe('Pentagon');
    const grid = shareGrid(level.mask);
    expect(lines.slice(5)).toEqual(grid.map((row) => row.map((v) => (v ? SHARE_GLYPH_ON : SHARE_GLYPH_OFF)).join('')));
    expect(SHARE_GLYPH_ON).toBe('🟪');
    expect(SHARE_GLYPH_OFF).toBe('⬜');
  });

  it('every row has the same glyph count, and only the two glyphs', () => {
    for (const day of DAYS) {
      const rows = card(day).split('\n\n')[1].split('\n');
      const counts = rows.map((row) => [...row].length);
      expect(new Set(counts).size).toBe(1);
      for (const row of rows) expect([...row].every((g) => g === SHARE_GLYPH_ON || g === SHARE_GLYPH_OFF)).toBe(true);
    }
  });

  it(`stays within ${280} UTF-16 units for every day of 10 years, even with a 4-digit streak`, () => {
    expect(SHARE_CARD_MAX_LENGTH).toBe(280);
    let worst = 0;
    for (const day of DAYS) worst = Math.max(worst, card(day, { streak: 9999 }).length);
    expect(worst).toBeLessThanOrEqual(SHARE_CARD_MAX_LENGTH);
  });

  it('carries no URL, no "?", "&", "utm_", level index or other number than date, hearts and streak', () => {
    for (const day of DAYS.filter((d) => d % 7 === 0)) {
      const text = card(day, { streak: 12 });
      expect(text).not.toMatch(/[?&]|utm_|https?:|www\.|play\.google|\.com/i);
      const numbers = text.match(/\d+/g) ?? [];
      const date = dailyShareDate(day).split('-');
      expect(numbers).toEqual([...date, '3', String(generateDaily(day).hearts), '12']);
    }
  });

  it('a non-finite or negative streak / hearts never prints NaN or a minus sign', () => {
    const text = card(0, { streak: Number.NaN, heartsLeft: -1 });
    expect(text).not.toMatch(/NaN|Hearts left: -|Day streak: -/);
    expect(text).toContain('Day streak: 0');
    expect(text).toContain('Hearts left: 0/');
  });
});

/**
 * TF-02 B (META_SHARE_CARD_LEVEL, owner-approved shape 2026-10-13): the CAMPAIGN win panel's card.
 *   Arrows · Level <N>      (N exactly as the game header shows it: levelIndex + 1)
 *   <shape name>
 *   Hearts left: h/H
 *
 *   <the daily card's emoji grid (shareGrid)>
 */
describe('buildLevelShareText', () => {
  // A 3 x 3 plus, cropped from a 5 x 5 mask: the exact text, character for character.
  const PLUS = [
    [false, false, false, false, false],
    [false, false, true, false, false],
    [false, true, true, true, false],
    [false, false, true, false, false],
    [false, false, false, false, false],
  ];

  it('exact text for one level', () => {
    expect(buildLevelShareText({ levelNumber: 7, mask: PLUS, shapeName: 'Plus', heartsLeft: 2, maxHearts: 3 })).toBe(
      'Arrows · Level 7\nPlus\nHearts left: 2/3\n\n⬜🟪⬜\n🟪🟪🟪\n⬜🟪⬜',
    );
  });

  it('a real campaign level: header lines, a blank line, then the daily card\'s grid of its mask', () => {
    const level = LevelGenerator.generate(6, 1);
    const text = buildLevelShareText({ levelNumber: 7, mask: level.mask, shapeName: level.shapeName, heartsLeft: 3, maxHearts: level.hearts });
    const lines = text.split('\n');
    expect(lines.slice(0, 4)).toEqual(['Arrows · Level 7', level.shapeName, `Hearts left: 3/${level.hearts}`, '']);
    expect(lines.slice(4)).toEqual(shareGrid(level.mask).map((row) => row.map((v) => (v ? SHARE_GLYPH_ON : SHARE_GLYPH_OFF)).join('')));
    expect(lines.length).toBeGreaterThan(4);
  });

  it('carries no URL and no number other than the level number and the hearts', () => {
    const text = buildLevelShareText({ levelNumber: 1234, mask: PLUS, shapeName: 'Plus', heartsLeft: 1, maxHearts: 3 });
    expect(text).not.toMatch(/[?&]|utm_|https?:|www\.|play\.google|\.com/i);
    expect(text.match(/\d+/g)).toEqual(['1234', '1', '3']);
  });

  it('a non-finite, negative or fractional number never prints NaN, a minus sign or a decimal', () => {
    const text = buildLevelShareText({ levelNumber: Number.NaN, mask: PLUS, shapeName: 'Plus', heartsLeft: -1, maxHearts: 2.5 });
    expect(text).not.toMatch(/NaN|-|\./);
    expect(text.split('\n').slice(0, 3)).toEqual(['Arrows · Level 0', 'Plus', 'Hearts left: 0/2']);
  });

  it('an empty mask (no grid) is the header alone', () => {
    expect(buildLevelShareText({ levelNumber: 3, mask: [], shapeName: 'Plus', heartsLeft: 3, maxHearts: 3 }))
      .toBe('Arrows · Level 3\nPlus\nHearts left: 3/3');
  });

  it(`stays within SHARE_CARD_MAX_LENGTH (${SHARE_CARD_MAX_LENGTH}) for every level 0..9999, both generators, worst-case grid`, () => {
    // The worst grid is the full 10 x 10 box (shareGrid never exceeds it); every level's own shape name is measured.
    const full = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => true));
    let worst = 0;
    for (let index = 0; index < 10000; index++) {
      for (const version of [1, 2] as const) {
        const text = buildLevelShareText({ levelNumber: index + 1, mask: full, shapeName: shapeNameForLevel(index, version), heartsLeft: 3, maxHearts: 3 });
        worst = Math.max(worst, text.length);
      }
    }
    expect(worst).toBe(258); // "Arrows · Level 10000" + "Rectangle" + "Hearts left: 3/3" + 10 rows of 10 two-unit glyphs
    expect(worst).toBeLessThanOrEqual(SHARE_CARD_MAX_LENGTH);
  });
});
