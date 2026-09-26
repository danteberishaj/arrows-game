import {
  GEN_V2_ENABLED,
  classifySwitchLevel,
  resolveGenVersion,
  stampGenSwitchLevel,
  type GenSwitchSave,
  type GenVersion,
} from '../generatorVersion';
import { LevelGenerator, type GeneratedLevel } from '../levelGenerator';

// W3-05: the generator version seam. Pure tests over the resolver, the boot
// classification and the content-neutral v2 stub. The same classification over
// the real initSaveSystem() + AsyncStorage path lives in
// src/ui/__tests__/storage.test.ts (ruling F13).

describe('W3-05 resolveGenVersion', () => {
  test('the v2 flag ships OFF', () => {
    expect(GEN_V2_ENABLED).toBe(false);
  });

  test.each<[number, number | null, boolean, GenVersion]>([
    // enabled = false returns 1 for any input.
    [0, null, false, 1],
    [0, 0, false, 1],
    [41, 41, false, 1],
    [5000, 0, false, 1],
    // switch null returns 1 (never stamped, or a corrupt stored value).
    [0, null, true, 1],
    [5000, null, true, 1],
    // index < switch returns 1.
    [0, 41, true, 1],
    [40, 41, true, 1],
    // index >= switch returns 2.
    [41, 41, true, 2],
    [42, 41, true, 2],
    [0, 0, true, 2],
    [5000, 0, true, 2],
  ])('resolveGenVersion(%i, switch %p, enabled %p) = %i', (index, switchLevel, enabled, expected) => {
    expect(resolveGenVersion(index, switchLevel, enabled)).toBe(expected);
  });

  test('the default `enabled` is the shipped flag, so every index resolves to 1 today', () => {
    for (const [index, switchLevel] of [[0, 0], [41, 41], [9999, 0], [7, null]] as const) {
      expect(resolveGenVersion(index, switchLevel)).toBe(1);
    }
  });
});

describe('W3-05 classifySwitchLevel', () => {
  test('a fresh install switches at level 0', () => {
    expect(classifySwitchLevel({ fresh: true, currentLevel: 0 })).toBe(0);
  });

  test('an existing player keeps the board they stand on: switch = current + 1', () => {
    expect(classifySwitchLevel({ fresh: false, currentLevel: 40 })).toBe(41);
    // A daily-only player (level 0, totalSolved > 0) is not fresh: board 0 stays v1 (ruling I-3).
    expect(classifySwitchLevel({ fresh: false, currentLevel: 0 })).toBe(1);
  });
});

/** In-memory GenSwitchSave that records every write. */
function fakeSave(init: {
  healthy?: boolean;
  stamped?: boolean;
  currentLevel?: number;
  totalSolved?: number;
}): GenSwitchSave & { writes: number[] } {
  const writes: number[] = [];
  const healthy = init.healthy ?? true;
  return {
    writes,
    persistenceHealthy: healthy,
    genSwitchLevelStamped: init.stamped ?? false,
    currentLevel: init.currentLevel ?? 0,
    totalSolved: init.totalSolved ?? 0,
    setGenSwitchLevel(level: number): boolean {
      if (!healthy) return false;
      writes.push(level);
      return true;
    },
  };
}

describe('W3-05 stampGenSwitchLevel (the boot classification)', () => {
  test('flag OFF (the shipped default): nothing is written', () => {
    const save = fakeSave({ currentLevel: 40, totalSolved: 40 });
    expect(stampGenSwitchLevel(save)).toBeNull();
    expect(save.writes).toEqual([]);
  });

  test('flag ON, existing player at level 40: writes 41', () => {
    const save = fakeSave({ currentLevel: 40, totalSolved: 40 });
    expect(stampGenSwitchLevel(save, true)).toBe(41);
    expect(save.writes).toEqual([41]);
  });

  test('flag ON, fresh install: writes 0', () => {
    const save = fakeSave({});
    expect(stampGenSwitchLevel(save, true)).toBe(0);
    expect(save.writes).toEqual([0]);
  });

  test('flag ON, daily-only player (level 0, solves > 0): writes 1', () => {
    const save = fakeSave({ currentLevel: 0, totalSolved: 3 });
    expect(stampGenSwitchLevel(save, true)).toBe(1);
    expect(save.writes).toEqual([1]);
  });

  test('flag ON, key already present (valid or corrupt): never rewritten', () => {
    const save = fakeSave({ stamped: true, currentLevel: 40, totalSolved: 40 });
    expect(stampGenSwitchLevel(save, true)).toBeNull();
    expect(save.writes).toEqual([]);
  });

  test('flag ON, persistence unhealthy (failed or pending hydrate): nothing is written', () => {
    const save = fakeSave({ healthy: false, currentLevel: 0, totalSolved: 0 });
    expect(stampGenSwitchLevel(save, true)).toBeNull();
    expect(save.writes).toEqual([]);
  });
});

/** Everything a player can see about a board, plus its mask, as text. */
function serialize(level: GeneratedLevel): string {
  const lines = [
    level.shapeName,
    String(level.board.rows),
    String(level.board.cols),
    String(level.arrowCount),
    String(level.hearts),
    String(level.difficulty),
    String(level.targetCells),
    ...level.mask.map((row) => row.map((cell) => (cell ? '#' : '.')).join('')),
  ];
  for (const arrow of level.board.arrows()) lines.push(arrow.toLine());
  return lines.join('\n');
}

describe('W3-05 the seam', () => {
  // "v2 delegates to v1 until W3-10" was retired by W3-10, which gives v2 its
  // own content (the capacity-aware shape bag). v2's invariants now live in
  // shapeBag.test.ts and levelGenerator.test.ts's sweep(2); v1's content is
  // pinned by levelGenerator.test.ts's goldens and corpus fingerprint.
  test('generate(i) with no version is exactly generate(i, 1)', () => {
    for (const i of [0, 5, 239, 3827]) {
      expect(serialize(LevelGenerator.generate(i))).toBe(serialize(LevelGenerator.generate(i, 1)));
    }
  });
});
