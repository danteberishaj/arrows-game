import { LevelGenerator, shapeNameForLevel } from '../levelGenerator';
import {
  MAX_CATALOGUE_BITS,
  RETIRED_SHAPE_IDS,
  SHAPE_CATALOGUE,
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
] as const;

test('catalogue indices preserve the append-only collection save format', () => {
  // Collection save bits use these array indices: never reorder or replace an existing id.
  expect(SHAPE_CATALOGUE.slice(0, LOCKED_SHAPE_IDS.length)).toEqual(LOCKED_SHAPE_IDS);
  expect(SHAPE_CATALOGUE).toHaveLength(26);
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
