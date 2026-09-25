/**
 * W4-12 — renders candidate SHARE CARDS so the owner can rule on the share
 * artifact (W4-13: build it or cut it). The share feature itself stays
 * flagged OFF (owner ruling, docs/next-level/progress.md); this script writes
 * no app code and adds no dependency. It only prints candidate text so the
 * owner has something concrete to look at instead of ruling on a description.
 *
 * Two facts are already settled (see the W4-12 brief):
 *   - React Native's `Share` on Android takes only `title` and `message`; any
 *     URL has to live INSIDE the message text
 *     (node_modules/react-native/Libraries/Share/Share.d.ts:56-59).
 *   - The Skia board view holds only feedback nodes, not the arrows, so there
 *     is no image snapshot to share — a share card can only be TEXT (glyphs
 *     standing in for filled/empty cells), and `expo-sharing` (needed for an
 *     image) is not installed. Every candidate below is therefore a plain
 *     string a native `Share.share({ message })` call could send verbatim.
 *
 * WHICH BOARDS. The card must be "built from `generateDaily(day).mask`"
 * (brief, verbatim) — the REAL, unforced daily draw, not a shape forced
 * through `generateDailyFromPool` — and it must cover "every shape in
 * DAILY_POOL_V1". A single fixed day only ever yields one shape, so covering
 * all 24 shapes from the real `generateDaily(day)` path means scanning days
 * forward and collecting the first 5 natural occurrences of each shape ("5
 * fixed days" per shape — deterministic, since the scan order never changes).
 * A quick survey (day 0..167) found every DAILY_POOL_V1 shape's 5th
 * occurrence within that window, so the scan cap below (2000) is generous.
 * This also naturally surfaces the real extremes red-team finding brand-13
 * asked about: e.g. Bolt's native mask is 15x42 (aspect 0.36, the tallest),
 * Fish's is up to 32 wide (aspect ~1.9, the widest) — see
 * docs/next-level/measurements/ for the full survey this script's summary
 * table reproduces.
 *
 * HEARTS LEFT / DAY STREAK. These header fields are NOT a simulated play
 * result — nothing here plays a level. They are SCRIPT-PICKED placeholders,
 * varied across the 5 occurrences per shape ONLY to exercise 1-, 2- and
 * 3-digit streak widths in the header (the digit count is what can move the
 * character-budget answer; the picture and the rest of the header do not
 * depend on it). Hearts-left is clamped to the level's own `hearts` (always 3
 * for the Normal-only daily pool per src/core/difficulty.ts), so it never
 * exceeds a single digit and never stresses width.
 *
 * PLACEHOLDER URL. `com.danteb.arrows` is this project's real (unpublished)
 * Android package id (app.json) — the Play Store URL below is the shape a
 * real listing link would take, NOT a claim the app is live. It is one
 * illustrative candidate for the owner's "which URL" ruling, not a
 * recommendation.
 *
 * OUTPUT (both files deterministic — see the `diff` command below):
 *   <out>/share-card-candidates.txt — full card text for every DAILY_POOL_V1
 *     shape's FIRST natural occurrence (24 shapes x 4 widths x 3 glyph sets x
 *     2 URL options = 576 printed cards), a per-card metrics table covering
 *     ALL 120 boards (24 shapes x 5 occurrences) x 24 render variants = 2880
 *     rows (so the summary table's maxima are not a single lucky/unlucky
 *     day), and the summary tables themselves.
 *   <out>/owner-share-cards.txt — the curated, side-by-side owner sheet with
 *     the exact ruling questions (a .txt, per the task instructions, since
 *     every candidate here is text — no PNG rendering risk from emoji
 *     font/advance-width differences, which is itself UNVERIFIED-DEVICE; see
 *     the brief's verification section).
 *
 * Run:   npx tsx scripts/analysis/share-card-candidates.ts artifacts/W4-12
 * Determinism check:
 *   npx tsx scripts/analysis/share-card-candidates.ts /tmp/w412-a
 *   npx tsx scripts/analysis/share-card-candidates.ts /tmp/w412-b
 *   diff -r /tmp/w412-a /tmp/w412-b
 */
import * as fs from 'fs';
import * as path from 'path';
import { DAILY_POOL_V1, generateDaily } from '../../src/core';
import type { GeneratedLevel } from '../../src/core';

// ---------------------------------------------------------------------------
// Candidate axes named in the brief.
// ---------------------------------------------------------------------------

const WIDTHS: readonly number[] = [8, 10, 12, 16]; // brief W4-12

interface GlyphSet {
  readonly label: string;
  readonly filled: string;
  readonly empty: string;
}

// brief W4-12: {⬛/⬜, ■/□, 🟪/⬜}. ⬛⬜■□ are single BMP code points (one UTF-16
// unit each); 🟪 is astral (U+1F7EA, a surrogate PAIR — two UTF-16 units, one
// code point). Pairing it with the BMP ⬜ means glyph set 3 is the one where
// UTF-16 length and code-point count diverge — exactly the kind of thing the
// per-card metrics below exist to catch instead of asserting.
const GLYPH_SETS: readonly GlyphSet[] = [
  { label: '⬛/⬜', filled: '⬛', empty: '⬜' },
  { label: '■/□', filled: '■', empty: '□' },
  { label: '🟪/⬜', filled: '🟪', empty: '⬜' },
];

// Grounded in app.json's real (unpublished) Android package id. NOT a live
// listing; one illustrative candidate for the owner's URL ruling.
const PLACEHOLDER_URL = 'https://play.google.com/store/apps/details?id=com.danteb.arrows';

const OCCURRENCES_PER_SHAPE = 5; // brief W4-12: "5 fixed days"
const SCAN_DAY_CAP = 2000; // generous: a day-0..167 survey found every shape's 5th hit

// SCRIPT-PICKED placeholders (not shipped, not simulated play) — see header
// comment. Digit widths: 1, 1, 2, 3, 3.
const DAY_STREAK_BY_OCCURRENCE: readonly number[] = [1, 7, 21, 100, 365];
const HEARTS_LEFT_BY_OCCURRENCE: readonly number[] = [3, 2, 1, 3, 2];

// Daily day numbers are days since 2020-01-01 UTC (src/core/saveSystem.ts
// dayNumber(), epoch = Date.UTC(2020, 0, 1)). Reproduced here, not imported,
// because saveSystem's version also folds in the caller's local timezone
// offset (a live-clock concern); this script only needs a stable label for a
// fixed day number, so it stays in UTC.
const DAILY_EPOCH_MS = Date.UTC(2020, 0, 1);

function dateLabelForDay(day: number): string {
  return new Date(DAILY_EPOCH_MS + day * 86_400_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Mask -> cropped, downsampled boolean grid.
// ---------------------------------------------------------------------------

interface BoundingBox {
  readonly minRow: number;
  readonly maxRow: number;
  readonly minCol: number;
  readonly maxCol: number;
}

function boundingBox(mask: readonly (readonly boolean[])[]): BoundingBox {
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;
  for (let r = 0; r < mask.length; r++) {
    for (let c = 0; c < mask[r].length; c++) {
      if (mask[r][c]) {
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
      }
    }
  }
  if (minRow === Infinity) throw new Error('mask has no filled cell — generateDaily should never produce this');
  return { minRow, maxRow, minCol, maxCol };
}

function cropToBoundingBox(mask: readonly (readonly boolean[])[]): boolean[][] {
  const box = boundingBox(mask);
  const out: boolean[][] = [];
  for (let r = box.minRow; r <= box.maxRow; r++) {
    const row: boolean[] = [];
    for (let c = box.minCol; c <= box.maxCol; c++) row.push(mask[r][c]);
    out.push(row);
  }
  return out;
}

/**
 * Box-downsamples a cropped mask to exactly `targetWidth` columns, keeping
 * the source aspect ratio for the row count (rounded, minimum 1). Each output
 * cell is the majority (>=50% coverage) of its source block, so every row of
 * the result has EXACTLY `targetWidth` cells by construction — the "equal
 * glyph counts" acceptance criterion holds structurally, and `assertRectangular`
 * below checks that construction rather than trusting it silently.
 */
function downsample(cropped: readonly (readonly boolean[])[], targetWidth: number): boolean[][] {
  const srcHeight = cropped.length;
  const srcWidth = cropped[0].length;
  const dstWidth = targetWidth;
  const dstHeight = Math.max(1, Math.round((targetWidth * srcHeight) / srcWidth));

  const out: boolean[][] = [];
  for (let r = 0; r < dstHeight; r++) {
    const rowStart = Math.floor((r * srcHeight) / dstHeight);
    const rowEnd = Math.max(rowStart + 1, Math.floor(((r + 1) * srcHeight) / dstHeight));
    const row: boolean[] = [];
    for (let c = 0; c < dstWidth; c++) {
      const colStart = Math.floor((c * srcWidth) / dstWidth);
      const colEnd = Math.max(colStart + 1, Math.floor(((c + 1) * srcWidth) / dstWidth));
      let filled = 0;
      let total = 0;
      for (let rr = rowStart; rr < rowEnd; rr++) {
        for (let cc = colStart; cc < colEnd; cc++) {
          total++;
          if (cropped[rr][cc]) filled++;
        }
      }
      row.push(total > 0 && filled / total >= 0.5);
    }
    out.push(row);
  }
  return out;
}

function assertRectangular(grid: readonly (readonly boolean[])[], width: number, context: string): void {
  for (let r = 0; r < grid.length; r++) {
    if (grid[r].length !== width) {
      throw new Error(`${context}: row ${r} has ${grid[r].length} cells, expected ${width}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Card text assembly.
// ---------------------------------------------------------------------------

interface Occurrence {
  readonly shapeName: string;
  readonly occurrenceIndex: number; // 0..4
  readonly day: number;
  readonly level: GeneratedLevel;
}

/** Scans generateDaily(day) forward and keeps the first N hits per pool shape. */
function collectOccurrences(pool: readonly string[], perShape: number, dayCap: number): Occurrence[] {
  const remaining = new Map<string, number>(pool.map((id) => [id, perShape]));
  const occurrences: Occurrence[] = [];
  let day = 0;
  while (day < dayCap && [...remaining.values()].some((n) => n > 0)) {
    const level = generateDaily(day);
    const left = remaining.get(level.shapeName);
    if (left !== undefined && left > 0) {
      occurrences.push({ shapeName: level.shapeName, occurrenceIndex: perShape - left, day, level });
      remaining.set(level.shapeName, left - 1);
    }
    day++;
  }
  const unmet = [...remaining].filter(([, n]) => n > 0);
  if (unmet.length > 0) {
    throw new Error(
      `collectOccurrences: day cap ${dayCap} exhausted before finding ${perShape} occurrences of: ` +
        unmet.map(([id, n]) => `${id} (${perShape - n}/${perShape})`).join(', '),
    );
  }
  // Stable order: pool order, then occurrence index — independent of the scan's
  // interleaved day order, so output order never depends on incidental timing.
  const byShapeThenOccurrence = new Map<string, Occurrence[]>(pool.map((id) => [id, []]));
  for (const occurrence of occurrences) byShapeThenOccurrence.get(occurrence.shapeName)!.push(occurrence);
  return pool.flatMap((id) => byShapeThenOccurrence.get(id)!.sort((a, b) => a.occurrenceIndex - b.occurrenceIndex));
}

function headerText(occurrence: Occurrence): string {
  const { level, occurrenceIndex } = occurrence;
  const heartsLeft = Math.min(HEARTS_LEFT_BY_OCCURRENCE[occurrenceIndex], level.hearts);
  const streak = DAY_STREAK_BY_OCCURRENCE[occurrenceIndex];
  return [
    `Arrows · ${dateLabelForDay(occurrence.day)}`,
    occurrence.shapeName,
    `Hearts left: ${heartsLeft}/${level.hearts}`,
    `Day streak: ${streak}`,
  ].join('\n');
}

function gridText(grid: readonly (readonly boolean[])[], glyphs: GlyphSet): string {
  return grid.map((row) => row.map((cell) => (cell ? glyphs.filled : glyphs.empty)).join('')).join('\n');
}

function buildCard(header: string, grid: string, url: string | null): string {
  const parts = [header, '', grid];
  if (url !== null) {
    parts.push('', url);
  }
  return parts.join('\n');
}

interface CardMetrics {
  readonly utf16Length: number;
  readonly codePointCount: number;
  readonly rowCount: number;
  readonly gridEmptyRows: number; // fully-empty rows in the picture (a legibility flag)
}

function measure(card: string, grid: readonly (readonly boolean[])[]): CardMetrics {
  return {
    utf16Length: card.length,
    codePointCount: [...card].length,
    rowCount: card.split('\n').length,
    gridEmptyRows: grid.filter((row) => row.every((cell) => !cell)).length,
  };
}

// ---------------------------------------------------------------------------
// Render one occurrence at one (width, glyph set, url) variant.
// ---------------------------------------------------------------------------

interface Rendered {
  readonly occurrence: Occurrence;
  readonly width: number;
  readonly glyphSet: GlyphSet;
  readonly hasUrl: boolean;
  readonly card: string;
  readonly metrics: CardMetrics;
  readonly gridRows: number;
}

function render(occurrence: Occurrence, width: number, glyphSet: GlyphSet, hasUrl: boolean): Rendered {
  const cropped = cropToBoundingBox(occurrence.level.mask);
  const grid = downsample(cropped, width);
  assertRectangular(grid, width, `${occurrence.shapeName}@day${occurrence.day} width=${width}`);
  const grid_ = gridText(grid, glyphSet);
  const card = buildCard(headerText(occurrence), grid_, hasUrl ? PLACEHOLDER_URL : null);
  return {
    occurrence,
    width,
    glyphSet,
    hasUrl,
    card,
    metrics: measure(card, grid),
    gridRows: grid.length,
  };
}

// ---------------------------------------------------------------------------
// Summary tables.
// ---------------------------------------------------------------------------

function printMetricsTable(out: string[], rendered: readonly Rendered[]): void {
  out.push('## Per-render metrics (all 120 boards x 24 render variants = 2880 rows)');
  out.push('');
  out.push(
    ['shape', 'day', 'date', 'occurrence', 'width', 'glyphSet', 'url', 'utf16Len', 'codePoints', 'rows', 'emptyGridRows'].join(
      '\t',
    ),
  );
  for (const r of rendered) {
    out.push(
      [
        r.occurrence.shapeName,
        r.occurrence.day,
        dateLabelForDay(r.occurrence.day),
        r.occurrence.occurrenceIndex,
        r.width,
        r.glyphSet.label,
        r.hasUrl ? 'with' : 'none',
        r.metrics.utf16Length,
        r.metrics.codePointCount,
        r.metrics.rowCount,
        r.metrics.gridEmptyRows,
      ].join('\t'),
    );
  }
  out.push('');
}

function printMaxLengthTable(out: string[], rendered: readonly Rendered[]): void {
  out.push('## Summary: maximum card length per (width, glyph set) — brand-13\'s unmeasured ceiling');
  out.push('');
  out.push(
    'Maximum over all 120 boards (24 DAILY_POOL_V1 shapes x 5 real generateDaily(day) occurrences each).',
  );
  out.push('');
  out.push(
    ['width', 'glyphSet', 'maxUtf16(noURL)', 'maxUtf16(withURL)', 'maxCodePoints(noURL)', 'maxCodePoints(withURL)'].join(
      ' | ',
    ),
  );
  out.push('---|---|---|---|---|---');
  for (const width of WIDTHS) {
    for (const glyphSet of GLYPH_SETS) {
      const cell = rendered.filter((r) => r.width === width && r.glyphSet.label === glyphSet.label);
      const noUrl = cell.filter((r) => !r.hasUrl);
      const withUrl = cell.filter((r) => r.hasUrl);
      const max = (rows: readonly Rendered[], pick: (r: Rendered) => number): number =>
        Math.max(...rows.map(pick));
      out.push(
        [
          width,
          glyphSet.label,
          max(noUrl, (r) => r.metrics.utf16Length),
          max(withUrl, (r) => r.metrics.utf16Length),
          max(noUrl, (r) => r.metrics.codePointCount),
          max(withUrl, (r) => r.metrics.codePointCount),
        ].join(' | '),
      );
    }
  }
  out.push('');
}

function printRowCeilingTable(out: string[], rendered: readonly Rendered[]): void {
  out.push('## Summary: maximum picture ROW count per width — brand-13\'s unmeasured 16-row ceiling');
  out.push('');
  out.push('width | maxRows | shape@day (the board that produced it)');
  out.push('---|---|---');
  for (const width of WIDTHS) {
    const atWidth = rendered.filter((r) => r.width === width && r.glyphSet.label === GLYPH_SETS[0].label && !r.hasUrl);
    let worst = atWidth[0];
    for (const r of atWidth) if (r.gridRows > worst.gridRows) worst = r;
    const overCeiling = worst.gridRows > 16 ? ' — OVER the 16-row ceiling' : '';
    out.push(`${width} | ${worst.gridRows} | ${worst.occurrence.shapeName}@day${worst.occurrence.day}${overCeiling}`);
  }
  out.push('');
}

// ---------------------------------------------------------------------------
// Owner sheet.
// ---------------------------------------------------------------------------

function padBlockLines(lines: readonly string[]): { readonly lines: string[]; readonly width: number } {
  const width = Math.max(0, ...lines.map((l) => [...l].length));
  return { lines: lines.map((l) => l + ' '.repeat(width - [...l].length)), width };
}

/** Places blocks of text side by side, left to right, with a fixed gap. */
function sideBySide(blocks: readonly (readonly string[])[], gap = 4): string[] {
  const padded = blocks.map(padBlockLines);
  const height = Math.max(...padded.map((b) => b.lines.length));
  const out: string[] = [];
  for (let r = 0; r < height; r++) {
    out.push(
      padded
        .map((b) => b.lines[r] ?? ' '.repeat(b.width))
        .join(' '.repeat(gap)),
    );
  }
  return out;
}

function buildOwnerSheet(occurrencesByShape: ReadonlyMap<string, Occurrence>, rendered: readonly Rendered[]): string {
  const out: string[] = [];
  out.push('W4-12 — SHARE CARD CANDIDATES — owner decision sheet');
  out.push('='.repeat(56));
  out.push('');
  out.push('Generated from the real generateDaily(day).mask (scripts/analysis/share-card-candidates.ts).');
  out.push('The share feature stays flagged OFF regardless of this ruling; W4-13 is build-or-cut.');
  out.push('');
  out.push('QUESTIONS THE OWNER MUST ANSWER (recorded on W4-13\'s status line):');
  out.push('  1) Build it, or cut it?');
  out.push(`  2) URL or no URL — and if yes, which? (placeholder shown below: ${PLACEHOLDER_URL})`);
  out.push('  3) Which glyph set — ⬛/⬜, ■/□, or 🟪/⬜?');
  out.push('  4) Which column width — 8, 10, 12, or 16?');
  out.push('');
  out.push(
    'Caveat (brief §4, UNVERIFIED-DEVICE): a real messaging app\'s font may not give every glyph the',
  );
  out.push(
    'same on-screen advance width, especially the emoji glyph set (🟪). The side-by-side alignment',
  );
  out.push('below assumes a monospace font and is not proof of real-app rendering.');
  out.push('');

  const circle = occurrencesByShape.get('Circle')!; // near-square, first pool entry — the "typical" example
  const bolt = occurrencesByShape.get('Bolt')!; // tallest aspect in the pool (native mask ~15x42)
  const fish = occurrencesByShape.get('Fish')!; // widest aspect in the pool (native mask up to ~32 wide)

  out.push('-'.repeat(56));
  out.push('A) GLYPH SET comparison — Circle, width=12, no URL');
  out.push('-'.repeat(56));
  out.push('');
  const glyphBlocks = GLYPH_SETS.map((glyphSet) => {
    const r = render(circle, 12, glyphSet, false);
    return [`[${glyphSet.label}]`, ...r.card.split('\n')];
  });
  out.push(...sideBySide(glyphBlocks));
  out.push('');

  out.push('-'.repeat(56));
  out.push('B) COLUMN WIDTH comparison — Circle, glyph=■/□, no URL');
  out.push('-'.repeat(56));
  out.push('');
  const widthBlocks = WIDTHS.map((width) => {
    const r = render(circle, width, GLYPH_SETS[1], false);
    return [`[width=${width}, rows=${r.gridRows}]`, ...r.card.split('\n')];
  });
  out.push(...sideBySide(widthBlocks));
  out.push('');

  out.push('-'.repeat(56));
  out.push('C) WORST CASES in the whole pool — glyph=■/□, width=12, no URL');
  out.push('-'.repeat(56));
  out.push('(Bolt = tallest native aspect, 0.36 w/h; Fish = widest, up to ~1.9 w/h)');
  out.push('');
  const worstBlocks = [bolt, fish].map((occ) => {
    const r = render(occ, 12, GLYPH_SETS[1], false);
    const ceiling = r.gridRows > 16 ? ' <- OVER 16-row ceiling' : '';
    return [`[${occ.shapeName}, rows=${r.gridRows}${ceiling}]`, ...r.card.split('\n')];
  });
  out.push(...sideBySide(worstBlocks));
  out.push('');

  out.push('-'.repeat(56));
  out.push('D) URL line — Circle, glyph=■/□, width=12');
  out.push('-'.repeat(56));
  out.push('');
  const urlBlocks = [false, true].map((hasUrl) => {
    const r = render(circle, 12, GLYPH_SETS[1], hasUrl);
    return [`[${hasUrl ? 'WITH url' : 'without url'}, utf16=${r.metrics.utf16Length}]`, ...r.card.split('\n')];
  });
  out.push(...sideBySide(urlBlocks));
  out.push('');

  out.push('-'.repeat(56));
  out.push('E) Character/row budget — maxima across all 120 boards (see share-card-candidates.txt for full data)');
  out.push('-'.repeat(56));
  out.push('');
  printMaxLengthTable(out, rendered);
  printRowCeilingTable(out, rendered);

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

function main(): void {
  const outputDirectory = process.argv[2];
  if (outputDirectory === undefined || outputDirectory.length === 0) {
    throw new Error('Usage: npx tsx scripts/analysis/share-card-candidates.ts <output-dir>');
  }
  fs.mkdirSync(outputDirectory, { recursive: true });

  const occurrences = collectOccurrences(DAILY_POOL_V1, OCCURRENCES_PER_SHAPE, SCAN_DAY_CAP);
  console.log(
    `Collected ${occurrences.length} boards: ${DAILY_POOL_V1.length} shapes x ${OCCURRENCES_PER_SHAPE} ` +
      `real generateDaily(day) occurrences each (scan cap ${SCAN_DAY_CAP} days).`,
  );

  const firstOccurrenceByShape = new Map<string, Occurrence>();
  for (const occurrence of occurrences) {
    if (occurrence.occurrenceIndex === 0) firstOccurrenceByShape.set(occurrence.shapeName, occurrence);
  }

  // Full metrics matrix: every board x every render variant (2880 rows).
  const allRendered: Rendered[] = [];
  for (const occurrence of occurrences) {
    for (const width of WIDTHS) {
      for (const glyphSet of GLYPH_SETS) {
        for (const hasUrl of [false, true]) {
          allRendered.push(render(occurrence, width, glyphSet, hasUrl));
        }
      }
    }
  }

  // Full printed card text: only the FIRST occurrence per shape (24 shapes x
  // 24 variants = 576 printed cards) — every shape gets a real, readable
  // example; occurrences 1-4 contribute measurements only (see file header).
  const printedCards = allRendered.filter((r) => r.occurrence.occurrenceIndex === 0);

  const dump: string[] = [];
  dump.push('# W4-12 — share card candidates (full dump)');
  dump.push('');
  dump.push(
    `Boards: ${occurrences.length} (${DAILY_POOL_V1.length} DAILY_POOL_V1 shapes x ${OCCURRENCES_PER_SHAPE} ` +
      'real generateDaily(day) occurrences each, first hits scanning day 0 upward).',
  );
  dump.push(`Printed cards below: ${printedCards.length} (one shape's first occurrence x ${WIDTHS.length} widths x ` +
    `${GLYPH_SETS.length} glyph sets x 2 URL options).`);
  dump.push(`Metrics table below: ${allRendered.length} rows (all ${occurrences.length} boards x every render variant).`);
  dump.push('');
  dump.push('## Printed cards (one example per DAILY_POOL_V1 shape, in pool order)');
  dump.push('');
  for (const shapeId of DAILY_POOL_V1) {
    const cardsForShape = printedCards.filter((r) => r.occurrence.shapeName === shapeId);
    dump.push(`### ${shapeId} (day ${cardsForShape[0].occurrence.day}, ${dateLabelForDay(cardsForShape[0].occurrence.day)})`);
    dump.push('');
    for (const r of cardsForShape) {
      dump.push(
        `--- width=${r.width} glyphSet=${r.glyphSet.label} url=${r.hasUrl ? 'with' : 'none'} ` +
          `(utf16=${r.metrics.utf16Length}, codePoints=${r.metrics.codePointCount}, rows=${r.metrics.rowCount}) ---`,
      );
      dump.push(r.card);
      dump.push('');
    }
  }

  printMetricsTable(dump, allRendered);
  printMaxLengthTable(dump, allRendered);
  printRowCeilingTable(dump, allRendered);

  const dumpText = dump.join('\n');
  const dumpPath = path.join(outputDirectory, 'share-card-candidates.txt');
  fs.writeFileSync(dumpPath, dumpText, 'utf8');
  console.log(`Wrote ${dumpPath} (${dumpText.length} UTF-16 code units)`);

  const ownerSheet = buildOwnerSheet(firstOccurrenceByShape, allRendered);
  const ownerSheetPath = path.join(outputDirectory, 'owner-share-cards.txt');
  fs.writeFileSync(ownerSheetPath, ownerSheet, 'utf8');
  console.log(`Wrote ${ownerSheetPath} (${ownerSheet.length} UTF-16 code units)`);
}

main();
