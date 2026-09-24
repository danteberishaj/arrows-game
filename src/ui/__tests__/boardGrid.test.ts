import { initialCamera, panRange } from '../boardCamera';
import {
  boardGridFor,
  gridColors,
  gridExtent,
  gridRestrokeNeeded,
  gridStroke,
  GRID_OVERSCROLL_FRACTION,
  GRID_STROKE_STEP,
  nativeGridProps,
  serializeGridExtent,
  serializeGridStyle,
  type GridExtentInput,
} from '../boardGrid';
import { Daylight, InkNight } from '../theme';

const CELL = 40;

/** Raw layouts and bottom insets measured on the API 31 emulator
 * (docs/board-viewport-measured.md; POLISH-T2 fix round 1). */
const LAYOUTS = [
  { name: '411x804 inset 48', w: 411.428571, h: 804.285706, inset: 48 },
  { name: '360x689 inset 56', w: 360, h: 689, inset: 56 },
  { name: '360x549 inset 0', w: 360, h: 549, inset: 0 },
] as const;

const BOARDS = [
  { name: '5x5', rows: 5, cols: 5 },
  { name: '8x8', rows: 8, cols: 8 },
  { name: '20x20', rows: 20, cols: 20 },
  { name: '39x39', rows: 39, cols: 39 },
  { name: '46x46', rows: 46, cols: 46 },
  { name: '4x46 (narrow tall)', rows: 46, cols: 4 },
] as const;

function inputFor(
  layout: (typeof LAYOUTS)[number],
  board: { rows: number; cols: number },
  zoomed: boolean,
): GridExtentInput {
  const cameraW = layout.w;
  const cameraH = zoomed ? layout.h - layout.inset : layout.h;
  const boardW = board.cols * CELL;
  const boardH = board.rows * CELL;
  const cam = initialCamera(cameraW, cameraH, boardW, boardH, CELL, zoomed)!;
  return {
    boardW,
    boardH,
    cell: CELL,
    layoutW: layout.w,
    layoutH: layout.h,
    cameraW,
    cameraH,
    minScale: cam.minScale,
    maxScale: cam.maxScale,
  };
}

/** Deterministic PRNG so the sweep is reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('gridExtent: covers every board-space point the camera can show', () => {
  const cases = LAYOUTS.flatMap((l) =>
    BOARDS.flatMap((b) => [false, true].map((z) => [l.name, b.name, z, l, b] as const)),
  );

  it.each(cases)('%s, %s, zoomed camera %s', (_ln, _bn, zoomed, layout, board) => {
    const input = inputFor(layout, board, zoomed);
    const ext = gridExtent(input)!;
    expect(ext).not.toBeNull();
    // The extent always contains the board itself.
    expect(ext.minCol).toBeLessThanOrEqual(0);
    expect(ext.minRow).toBeLessThanOrEqual(0);
    expect(ext.maxCol).toBeGreaterThanOrEqual(board.cols - 1);
    expect(ext.maxRow).toBeGreaterThanOrEqual(board.rows - 1);

    // Brute force: random reachable cameras (scale in [min, max], translation in
    // panRange widened by the rubber-band overscroll), visible rect = the RAW
    // layout mapped to board space. Every cell centre in view must be a dot.
    const rand = mulberry32(board.rows * 1000 + board.cols + (zoomed ? 7 : 0));
    const overX = GRID_OVERSCROLL_FRACTION * input.cameraW;
    const overY = GRID_OVERSCROLL_FRACTION * input.cameraH;
    const scales = [input.minScale, input.maxScale, input.cameraW / input.boardW,
      input.cameraH / input.boardH];
    for (let i = 0; i < 400; i += 1) scales.push(input.minScale + rand() * (input.maxScale - input.minScale));
    for (const s of scales) {
      if (s < input.minScale || s > input.maxScale) continue;
      const [xlo, xhi] = panRange(input.boardW * s, input.cameraW);
      const [ylo, yhi] = panRange(input.boardH * s, input.cameraH);
      for (const tx of [xlo - overX, xhi + overX]) {
        for (const ty of [ylo - overY, yhi + overY]) {
          const visMinX = -tx / s;
          const visMaxX = (input.layoutW - tx) / s;
          const visMinY = -ty / s;
          const visMaxY = (input.layoutH - ty) / s;
          // First and last cell centre inside the visible rect.
          const firstCol = Math.ceil(visMinX / CELL - 0.5);
          const lastCol = Math.floor(visMaxX / CELL - 0.5);
          const firstRow = Math.ceil(visMinY / CELL - 0.5);
          const lastRow = Math.floor(visMaxY / CELL - 0.5);
          expect(ext.minCol).toBeLessThanOrEqual(firstCol);
          expect(ext.maxCol).toBeGreaterThanOrEqual(lastCol);
          expect(ext.minRow).toBeLessThanOrEqual(firstRow);
          expect(ext.maxRow).toBeGreaterThanOrEqual(lastRow);
        }
      }
    }
  });

  it('is bounded: the densest board stays near the research estimate (113 x 192 cells)', () => {
    const ext = gridExtent(inputFor(LAYOUTS[0], { rows: 46, cols: 46 }, false))!;
    const cols = ext.maxCol - ext.minCol + 1;
    const rows = ext.maxRow - ext.minRow + 1;
    expect(cols * rows).toBeLessThan(40000);
    expect(cols).toBeLessThan(140);
    expect(rows).toBeLessThan(230);
  });

  it('returns null before layout', () => {
    const input = inputFor(LAYOUTS[0], { rows: 20, cols: 20 }, false);
    expect(gridExtent({ ...input, layoutW: 0 })).toBeNull();
    expect(gridExtent({ ...input, minScale: 0 })).toBeNull();
  });
});

describe('gridStroke: on-screen size is absolute dp (design spec A)', () => {
  const onScreen = (scale: number) => {
    const { dotRadius, lineWidth } = gridStroke(scale, CELL);
    return { r: dotRadius * scale, w: lineWidth * scale };
  };

  it.each([
    // cell dp -> expected on-screen radius: clamp(0.07 * cellDp, 0.9, 1.75)
    [8.4, 0.9],
    [9.9, 0.9],
    [12.9, 0.903],
    [19.3, 1.351],
    [29.4, 1.75],
    [64, 1.75],
  ])('cell %p dp -> dot radius %p dp, line 1 dp', (cellDp, r) => {
    const s = cellDp / CELL;
    expect(onScreen(s).r).toBeCloseTo(r, 3);
    expect(onScreen(s).w).toBeCloseTo(1, 9);
  });

  it('dot radius never exceeds the shaft half-width once the dot is past its floor', () => {
    for (let cellDp = 12.6; cellDp <= 64; cellDp += 0.1) {
      expect(onScreen(cellDp / CELL).r).toBeLessThanOrEqual(0.072 * cellDp + 1e-9);
    }
  });
});

describe('gridRestrokeNeeded: re-send only on a 2^(1/4) zoom step', () => {
  it('fires on the first scale and on each ~1.19x step, not on pans', () => {
    expect(GRID_STROKE_STEP).toBeCloseTo(Math.pow(2, 0.25), 12);
    expect(gridRestrokeNeeded(0, 0.5)).toBe(true);
    expect(gridRestrokeNeeded(0.5, 0.5)).toBe(false);
    expect(gridRestrokeNeeded(0.5, 0.5 * 1.18)).toBe(false);
    expect(gridRestrokeNeeded(0.5, 0.5 * 1.19)).toBe(true);
    expect(gridRestrokeNeeded(0.5, 0.5 / 1.18)).toBe(false);
    expect(gridRestrokeNeeded(0.5, 0.5 / 1.19)).toBe(true);
    expect(gridRestrokeNeeded(0.5, 0)).toBe(false);
  });

  it('a fit -> max pinch on 46x46 crosses about 12 steps', () => {
    const input = inputFor(LAYOUTS[0], { rows: 46, cols: 46 }, false);
    let sent = 0;
    let sends = 0;
    for (let s = input.minScale; s <= input.maxScale; s *= 1.002) {
      if (gridRestrokeNeeded(sent, s)) {
        sent = s;
        sends += 1;
      }
    }
    expect(sends).toBeGreaterThanOrEqual(11);
    expect(sends).toBeLessThanOrEqual(13);
  });
});

describe('gridColors: border composited over bg (ruling R4a)', () => {
  it('matches the design spec hexes in both themes', () => {
    expect(gridColors(Daylight)).toEqual({ dot: '#D2CCE8', line: '#E3DFF1' });
    expect(gridColors(InkNight)).toEqual({ dot: '#353150', line: '#29253D' });
  });
});

describe('native payload', () => {
  const layout = LAYOUTS[0];
  const board = { rows: 20, cols: 20 };
  const base = {
    boardW: board.cols * CELL,
    boardH: board.rows * CELL,
    cell: CELL,
    layoutW: layout.w,
    layoutH: layout.h,
    bottomInset: 0,
    zoomedCamera: false,
    palette: Daylight,
    linesOn: false,
    strokeScale: 0.48,
  };

  it('flag OFF: no grid object and NO grid props reach the native view', () => {
    const grid = boardGridFor({ ...base, enabled: false });
    expect(grid).toBeNull();
    const props = nativeGridProps(grid, false);
    expect(props).toEqual({});
    expect(Object.keys(props)).toHaveLength(0);
    // Spreading it leaves today's prop object byte-identical.
    const today = { geometry: 'g', visibleMask: '1', ink: '#191724', strokeWidth: 5.76, exitAnimation: '' };
    expect(JSON.stringify({ ...today, ...props })).toBe(JSON.stringify(today));
  });

  it('flag ON: extent and style strings', () => {
    const grid = boardGridFor({ ...base, enabled: true })!;
    expect(grid).not.toBeNull();
    const ext = serializeGridExtent(grid);
    const tokens = ext.split(',');
    expect(tokens).toHaveLength(7);
    expect(tokens[0]).toBe('40');
    expect(tokens.slice(1, 5).every((t) => /^-?\d+$/.test(t))).toBe(true);
    expect(tokens.slice(5)).toEqual(['#D2CCE8', '#E3DFF1']);
    const style = serializeGridStyle(grid);
    // POLISH-T8: a 4th token, the zoom the stroke sizes were sent for, selects the native tile renderer
    // and sizes its tile (round(cell x scale x density) px).
    const [r, w, lines, scale, ...rest] = style.split(',');
    // strokeScale 0.48 -> cell 19.2 dp -> radius 1.344 dp -> 2.8 board units
    expect(Number(r)).toBeCloseTo(1.344 / 0.48, 3);
    expect(Number(w)).toBeCloseTo(1 / 0.48, 3);
    expect(lines).toBe('0');
    expect(scale).toBe('0.48');
    expect(rest).toEqual([]);
    expect(serializeGridStyle({ ...grid, linesOn: true }).split(',')[2]).toBe('1');
    expect(nativeGridProps(grid, true)).toEqual({ grid: ext, gridStyle: style });
  });

  it('flag ON before layout: empty strings (native draws nothing)', () => {
    const grid = boardGridFor({ ...base, enabled: true, layoutW: 0, layoutH: 0 });
    expect(grid).toBeNull();
    expect(nativeGridProps(grid, true)).toEqual({ grid: '', gridStyle: '' });
  });

  it('flag ON, no stroke scale yet: extent is sent, style is empty', () => {
    const grid = boardGridFor({ ...base, enabled: true, strokeScale: 0 })!;
    expect(serializeGridStyle(grid)).toBe('');
  });

  it('POLISH-T8 PERF points switch: the 3-token POLISH-T4 style (drawPoints path), same stroke sizes', () => {
    const grid = boardGridFor({ ...base, enabled: true })!;
    const tile = serializeGridStyle(grid);
    const points = serializeGridStyle(grid, 'points');
    expect(points.split(',')).toHaveLength(3);
    expect(tile.startsWith(`${points},`)).toBe(true);
    expect(nativeGridProps(grid, true, 'points')).toEqual({ grid: serializeGridExtent(grid), gridStyle: points });
    expect(nativeGridProps(grid, true, 'tile')).toEqual(nativeGridProps(grid, true));
    // Flag OFF stays an empty object whatever the renderer, and no stroke scale stays empty.
    expect(nativeGridProps(null, false, 'points')).toEqual({});
    expect(serializeGridStyle({ ...grid, dotRadius: 0 }, 'points')).toBe('');
  });

  it('POLISH-T8: the stroke scale token is the zoom the stroke sizes came from', () => {
    for (const strokeScale of [0.2477, 0.734694, 1.6]) {
      const grid = boardGridFor({ ...base, enabled: true, strokeScale })!;
      const [r, w, , scale] = serializeGridStyle(grid).split(',').map(Number);
      expect(scale).toBeCloseTo(strokeScale, 4);
      expect(w).toBeCloseTo(1 / strokeScale, 3);
      expect(r * strokeScale).toBeGreaterThanOrEqual(0.9 - 1e-3);
      expect(r * strokeScale).toBeLessThanOrEqual(1.75 + 1e-3);
    }
  });
});
