import { EMPTY_SHAPE_MASKS, markSeen, type ShapeMasks } from '../collection';
import { LevelGenerator, shapeNameForLevel } from '../levelGenerator';
import { SaveSystem, type IntStore } from '../saveSystem';
import { catalogueIndexOf } from '../shapeCatalogue';

/**
 * W3-05 (ruling F11): the collection fold asks for each level's shape at the
 * generator version that dealt it, `resolveGenVersion(index, genSwitchLevel)`
 * from core, with no PERF/DEV override.
 *
 * Written while v2 still delegated to v1 (retired by W3-10), when the shapes
 * could not tell the versions apart. This file therefore (a) forces
 * GEN_V2_ENABLED on for the resolver's default
 * and (b) wraps the real `shapeNameForLevel` in a spy, to observe WHICH version
 * the fold asked for. Both mocks keep the real behaviour; only the flag moves.
 * Kept out of saveSystem.test.ts so the forced flag cannot leak into it.
 */
jest.mock('../generatorVersion', () => {
  const actual = jest.requireActual('../generatorVersion');
  return {
    ...actual,
    GEN_V2_ENABLED: true,
    resolveGenVersion: (index: number, switchLevel: number | null, enabled = true) =>
      actual.resolveGenVersion(index, switchLevel, enabled),
  };
});

jest.mock('../levelGenerator', () => {
  const actual = jest.requireActual('../levelGenerator');
  return { ...actual, shapeNameForLevel: jest.fn(actual.shapeNameForLevel) };
});

const lookup = shapeNameForLevel as jest.MockedFunction<typeof shapeNameForLevel>;

class MapStore implements IntStore {
  readonly map = new Map<string, number>();
  getInt(key: string, defaultValue: number): number {
    const v = this.map.get(key);
    return v === undefined ? defaultValue : v;
  }
  setInt(key: string, value: number): void {
    this.map.set(key, value);
  }
  deleteKey(key: string): void {
    this.map.delete(key);
  }
}

let store: MapStore;
let previousStore: IntStore;
let previousHealthy: boolean;

beforeEach(() => {
  store = new MapStore();
  previousStore = SaveSystem.useStore(store);
  previousHealthy = SaveSystem.persistenceHealthy;
  SaveSystem.setPersistenceHealthy(true);
  lookup.mockClear();
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  SaveSystem.setPersistenceHealthy(previousHealthy);
});

/** The version the fold asked for, per level index, from the spy's calls. */
function versionsAsked(): Map<number, unknown> {
  const asked = new Map<number, unknown>();
  for (const call of lookup.mock.calls) asked.set(call[0], call[1]);
  return asked;
}

/**
 * Ground truth from the FULL generator at the version each level was dealt,
 * for this install's switch level (V2-FINISH: an existing player's v2 boards
 * carry the v1 floor, so the switch level is part of the board).
 */
function truthMasks(to: number, switchLevel: number | null): ShapeMasks {
  let masks = EMPTY_SHAPE_MASKS;
  for (let i = 0; i < to; i += 1) {
    const version = switchLevel !== null && i >= switchLevel ? 2 : 1;
    masks = markSeen(masks, catalogueIndexOf(LevelGenerator.generate(i, version, { switchLevel }).shapeName));
  }
  return masks;
}

test('flag ON, switch 41, level 50: the menu fold asks v1 for levels 0..40 and v2 for 41..49', () => {
  store.setInt('arrows_current_level', 50);
  store.setInt('arrows_gen_switch_level', 41);

  expect(SaveSystem.syncCollection(5000)).toBe(0);

  const asked = versionsAsked();
  expect([...asked.keys()]).toEqual(Array.from({ length: 50 }, (_, i) => i));
  for (let i = 0; i < 50; i += 1) expect([i, asked.get(i)]).toEqual([i, i < 41 ? 1 : 2]);
  expect(SaveSystem.shapesSeen).toEqual(truthMasks(50, 41));
  expect(SaveSystem.shapesThroughLevel).toBe(50);
});

test('flag ON, switch 41: the campaign-clear fast path records level 50 at v2 and level 40 at v1', () => {
  store.setInt('arrows_gen_switch_level', 41);
  // A fold pointer always comes with a bit (FINAL-FIX: empty masks under a
  // pointer read as damage). Index 29 (Umbrella) is dealt by no v1 or daily board
  // (v2 has dealt it since W3-19, but not at the levels this test folds: 40 is v1
  // Circle and 50 floored v2 is Plus, W3-21 EXECUTED).
  store.setInt('arrows_shapes_seen_lo', 1 << 29);

  store.setInt('arrows_shapes_through_level', 40);
  SaveSystem.setCurrentLevel(41);
  SaveSystem.recordCampaignClear(40);
  expect(lookup.mock.calls).toEqual([[40, 1, 41]]);

  lookup.mockClear();
  store.setInt('arrows_shapes_through_level', 50);
  SaveSystem.setCurrentLevel(51);
  SaveSystem.recordCampaignClear(50);
  // V2-FINISH: the fold asks with the install's switch level, so level 50 is the floored board.
  expect(lookup.mock.calls).toEqual([[50, 2, 41]]);
  const want = [LevelGenerator.generate(40, 1), LevelGenerator.generate(50, 2, { switchLevel: 41 })]
    .reduce((m, lvl) => markSeen(m, catalogueIndexOf(lvl.shapeName)), { lo: 1 << 29, hi: 0 });
  expect(SaveSystem.shapesSeen).toEqual(want);
});

test('flag ON, key absent (never stamped) or corrupt (-5): every level folds at v1', () => {
  store.setInt('arrows_current_level', 12);
  SaveSystem.syncCollection(5000);
  expect(new Set(versionsAsked().values())).toEqual(new Set([1]));

  lookup.mockClear();
  store.map.clear();
  store.setInt('arrows_current_level', 12);
  store.setInt('arrows_gen_switch_level', -5);
  SaveSystem.syncCollection(5000);
  expect(new Set(versionsAsked().values())).toEqual(new Set([1]));
  expect(store.getInt('arrows_gen_switch_level', 0)).toBe(-5); // the fold never rewrites it
});

test('flag ON, fresh-install switch 0: every level folds at v2', () => {
  store.setInt('arrows_current_level', 12);
  store.setInt('arrows_gen_switch_level', 0);
  SaveSystem.syncCollection(5000);
  expect(new Set(versionsAsked().values())).toEqual(new Set([2]));
  expect(SaveSystem.shapesSeen).toEqual(truthMasks(12, 0));
});

test('V2-FINISH: every fold call carries the install\'s switch level (the board the player was actually dealt)', () => {
  store.setInt('arrows_current_level', 50);
  store.setInt('arrows_gen_switch_level', 41);
  SaveSystem.syncCollection(5000);
  const switchLevels = new Set(lookup.mock.calls.map((call) => call[2]));
  expect(switchLevels).toEqual(new Set([41]));
});

test('V2-FINISH: an existing player\'s folded bits are the floored boards\' shapes, not a fresh install\'s', () => {
  // Switch at 1 (a daily-only player): levels 1..79 are v2 with the v1 floor.
  store.setInt('arrows_current_level', 80);
  store.setInt('arrows_gen_switch_level', 1);
  SaveSystem.syncCollection(5000);
  expect(SaveSystem.shapesSeen).toEqual(truthMasks(80, 1));

  // Positive control: the same levels dealt as a fresh install's v2 (switch 0)
  // are different shapes, so a fold that dropped the switch level would be caught.
  let freshNames = 0;
  for (let i = 1; i < 80; i += 1) {
    if (LevelGenerator.generate(i, 2).shapeName !== LevelGenerator.generate(i, 2, { switchLevel: 1 }).shapeName) freshNames += 1;
  }
  expect(freshNames).toBeGreaterThan(20);
});
