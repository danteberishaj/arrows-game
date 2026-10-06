import { DAILY_VERSIONS } from '../dailyBoard';
import { LevelGenerator, shapeNameForLevel } from '../levelGenerator';
import {
  MAX_CATALOGUE_BITS,
  RETIRED_SHAPE_IDS,
  SHAPE_CATALOGUE,
  V2_ADMITTED_SHAPE_IDS,
  catalogueIndexOf,
  shapeDefFor,
} from '../shapeCatalogue';
import { ShapeLibrary } from '../shapeLibrary';

const LOCKED_SHAPE_IDS = [
  'Square',
  'Rectangle',
  'Circle',
  'Diamond',
  'Triangle',
  'Plus',
  'Hexagon',
  'Star',
  'Heart',
  'Trophy',
  'Crescent',
  'Flower',
  'Bolt',
  'Arrow',
  'Crown',
  'Hourglass',
  'Pentagon',
  'Octagon',
  'Ring',
  'X',
  'Butterfly',
  'Rocket',
  'Pine',
  'Cat',
  'Mushroom',
  'Fish',
  'House', // W3-18
  'Teacup', // W3-18
  'Bell', // W3-18
  'Umbrella', // W3-18
] as const;

test('catalogue indices preserve the append-only collection save format', () => {
  // Collection save bits use these array indices: never reorder or replace an existing id.
  expect(SHAPE_CATALOGUE.slice(0, LOCKED_SHAPE_IDS.length)).toEqual(LOCKED_SHAPE_IDS);
  expect(SHAPE_CATALOGUE).toHaveLength(30);
});

/** The 26 shapes v1 shipped: v1's tier pools, the daily pool and generator v2's bag all deal them. */
const V1_SHAPE_IDS: readonly string[] = LOCKED_SHAPE_IDS.slice(0, 26);

/**
 * W3-18: catalogue ids authored after v1 that no generator, pool or daily deals yet. Each waits for
 * the owner's recognition test (W3-19); a pass appends the id to V2_ADMITTED_SHAPE_IDS and removes
 * it here (and re-pins both v2 fingerprints).
 * W3-19 (owner ruling 2026-10-06, docs/silhouette-naming-2026-10-06.md): House, Teacup, Bell and
 * Umbrella pass and are admitted, so none is pending.
 */
const PENDING_RECOGNITION: readonly string[] = [];

/** W3-19: the shapes authored after v1 that v2 deals (owner ruling 2026-10-06). */
const ADMITTED_AFTER_V1: readonly string[] = ['House', 'Teacup', 'Bell', 'Umbrella'];

test('W3-18/W3-19: generator v2 admits the 26 v1 shapes plus the owner-passed W3-18 shapes; every other catalogue id awaits W3-19', () => {
  expect([...V2_ADMITTED_SHAPE_IDS]).toEqual([...V1_SHAPE_IDS, ...ADMITTED_AFTER_V1]);
  expect(SHAPE_CATALOGUE.filter((id) => !V2_ADMITTED_SHAPE_IDS.has(id))).toEqual(PENDING_RECOGNITION);
  for (const id of V2_ADMITTED_SHAPE_IDS) expect([id, catalogueIndexOf(id) >= 0]).toEqual([id, true]);
});

test('W3-18: a catalogue id authored after v1 (awaiting W3-19 or v2-admitted) is in no v1 tier pool and no daily pool version', () => {
  const v1 = new Set(
    [...ShapeLibrary.SimplePool, ...ShapeLibrary.MediumPool, ...ShapeLibrary.ComplexPool].map((s) => s.name),
  );
  const daily = new Set(DAILY_VERSIONS.flatMap((v) => v.pool));
  // W3-19: once admitted, a W3-18 shape is v2-only; admission never reaches v1 or the daily.
  const afterV1 = SHAPE_CATALOGUE.filter((id) => !V1_SHAPE_IDS.includes(id));
  expect(afterV1).toEqual([...ADMITTED_AFTER_V1, ...PENDING_RECOGNITION]);
  expect(afterV1.filter((id) => v1.has(id) || daily.has(id))).toEqual([]);
  // v1's pools and the daily pool are exactly the v1 shapes (the daily leaves out the two fills).
  expect([...v1].sort()).toEqual([...V1_SHAPE_IDS].sort());
  expect([...daily].every((id) => V1_SHAPE_IDS.includes(id))).toBe(true);
});

test('catalogue is frozen, distinct, and within its two-key capacity', () => {
  expect(Object.isFrozen(SHAPE_CATALOGUE)).toBe(true);
  expect(new Set(SHAPE_CATALOGUE).size).toBe(SHAPE_CATALOGUE.length);
  expect(SHAPE_CATALOGUE.length).toBeLessThanOrEqual(MAX_CATALOGUE_BITS);
});

test('every generator pool shape has a catalogue index', () => {
  const pools = [
    ShapeLibrary.SimplePool,
    ShapeLibrary.MediumPool,
    ShapeLibrary.ComplexPool,
  ];

  for (const pool of pools) {
    for (const shape of pool) {
      expect(catalogueIndexOf(shape.name)).toBeGreaterThanOrEqual(0);
    }
  }
});

test('catalogue ids resolve to definitions and unknown ids do not', () => {
  for (const id of SHAPE_CATALOGUE) {
    expect(shapeDefFor(id)?.name).toBe(id);
  }

  expect(catalogueIndexOf('UnknownShape')).toBe(-1);
  expect(shapeDefFor('UnknownShape')).toBeNull();
  expect(RETIRED_SHAPE_IDS.size).toBe(0);
});

test('cheap shape lookup stays equivalent to full level generation', () => {
  const indices = [
    ...Array.from({ length: 600 }, (_, index) => index),
    239,
    917,
    935,
    3827,
    5363,
  ];
  const mismatches = indices.filter(
    (index) => shapeNameForLevel(index) !== LevelGenerator.generate(index).shapeName,
  );

  expect(mismatches).toEqual([]);
});

test('W3-05: the cheap lookup is versioned and stays equivalent to generation at both versions', () => {
  // W4-01's contract for any generator version: shapeNameForLevel(i, v) is the
  // shape generate(i, v) deals; the collection fold relies on this. W3-10 gave
  // v2 its own branch (the shape bag, which picks without building the board);
  // shapeBag.test.ts extends this to v2 levels 0-1999 and v1 levels 0-999.
  const indices = [...Array.from({ length: 300 }, (_, index) => index), 239, 917, 935, 3827, 5363];
  for (const version of [1, 2] as const) {
    const mismatches = indices.filter(
      (index) => shapeNameForLevel(index, version) !== LevelGenerator.generate(index, version).shapeName,
    );
    expect([version, mismatches]).toEqual([version, []]);
  }
});
