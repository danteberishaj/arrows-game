import { EMPTY_SHAPE_MASKS, markSeen, type ShapeMasks } from '../collection';
import { LevelGenerator, shapeNameForLevel } from '../levelGenerator';
import { SaveSystem, type IntStore } from '../saveSystem';
import { catalogueIndexOf } from '../shapeCatalogue';

/**
 * W3-05 (ruling F11): the collection fold asks for each level's shape at the
 * generator version that dealt it, `resolveGenVersion(index, genSwitchLevel)`
 * from core, with no PERF/DEV override.
 *
 * v2 delegates to v1 until W3-10, so the shapes cannot tell the versions apart.
 * This file therefore (a) forces GEN_V2_ENABLED on for the resolver's default
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

/** Ground truth from the FULL generator at the version each level was dealt. */
function truthMasks(to: number, switchLevel: number | null): ShapeMasks {
  let masks = EMPTY_SHAPE_MASKS;
  for (let i = 0; i < to; i += 1) {
    const version = switchLevel !== null && i >= switchLevel ? 2 : 1;
    masks = markSeen(masks, catalogueIndexOf(LevelGenerator.generate(i, version).shapeName));
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

  store.setInt('arrows_shapes_through_level', 40);
  SaveSystem.setCurrentLevel(41);
  SaveSystem.recordCampaignClear(40);
  expect(lookup.mock.calls).toEqual([[40, 1]]);

  lookup.mockClear();
  store.setInt('arrows_shapes_through_level', 50);
  SaveSystem.setCurrentLevel(51);
  SaveSystem.recordCampaignClear(50);
  expect(lookup.mock.calls).toEqual([[50, 2]]);
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
