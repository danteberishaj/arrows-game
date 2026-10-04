import AsyncStorage from '@react-native-async-storage/async-storage';
import { LevelGenerator, SaveSystem, catalogueIndexOf, stampGenSwitchLevel, type IntStore } from '../../core';
import { EMPTY_SHAPE_MASKS, markSeen, type ShapeMasks } from '../../core/collection';
import { initSaveSystem } from '../storage';
import { getRewardState, recordRewardClear } from '../rewardLedger';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getAllKeys: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
  },
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

async function settlePersistence(): Promise<void> {
  // enqueue() uses queueMicrotask, then flush() chains work onto a promise.
  // Advance both queues without relying on timers or implementation details
  // from React Native's AsyncStorage mock.
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

beforeEach(async () => {
  jest.resetAllMocks();
  // A save already at the current schema, so boot writes nothing and the
  // write-batching tests below see only their own writes.
  storage.multiGet.mockResolvedValue([['arrows_schema_version', '1']]);
  storage.multiSet.mockResolvedValue();
  storage.multiRemove.mockResolvedValue();
  await initSaveSystem();
  await settlePersistence();
});

test('hydrates exactly the save-system keys with one native read', () => {
  expect(storage.multiGet).toHaveBeenCalledTimes(1);
  expect(storage.multiGet.mock.calls[0]?.[0]).toBe(SaveSystem.persistenceKeys);
  expect(Object.isFrozen(SaveSystem.persistenceKeys)).toBe(true);
  expect(SaveSystem.persistenceKeys).toEqual([
    'arrows_current_level',
    'arrows_total_solved',
    'arrows_perfect_streak',
    'arrows_best_perfect_streak',
    'arrows_day_streak',
    'arrows_last_play_day',
    'arrows_sound_on',
    'arrows_dark_mode',
    'arrows_schema_version',
    'arrows_finished_games',
    'arrows_ftue_stage',
    'arrows_streak_freezes',
    'arrows_streak_saved_day',
    'arrows_daily_last_day',
    'arrows_shapes_seen_lo',
    'arrows_shapes_seen_hi',
    'arrows_shapes_through_level',
    'arrows_review_count',
    'arrows_review_last_day',
    'arrows_gen_switch_level',
    'arrows_consent',
    'arrows_rc_kill_bits',
    'arrows_rc_version',
    'arrows_tel_install_hi',
    'arrows_tel_install_lo',
    'arrows_tel_session_count',
    'arrows_tel_fatal_pending',
    'arrows_tel_fatal_hash',
    'arrows_tel_fatal_screen',
  ]);
  expect(storage.getAllKeys).not.toHaveBeenCalled();
});

test('uses defaults for missing or malformed hydrated values', async () => {
  jest.clearAllMocks();
  storage.multiGet.mockResolvedValue([
    ['arrows_current_level', 'not-a-number'],
    ['arrows_total_solved', '42'],
    ['arrows_perfect_streak', null],
    ['arrows_sound_on', 'invalid'],
    ['arrows_dark_mode', '1'],
  ]);

  await initSaveSystem();

  expect(SaveSystem.currentLevel).toBe(0);
  expect(SaveSystem.totalSolved).toBe(42);
  expect(SaveSystem.perfectStreak).toBe(0);
  expect(SaveSystem.soundOn).toBe(true);
  expect(SaveSystem.darkMode).toBe(true);
  expect(storage.multiGet).toHaveBeenCalledTimes(1);
  expect(storage.getAllKeys).not.toHaveBeenCalled();
});

test('W0-05: a hydrated interstitial counter of "1" reads back as 1 after initSaveSystem()', async () => {
  jest.clearAllMocks();
  storage.multiGet.mockResolvedValue([
    ['arrows_schema_version', '1'],
    ['arrows_finished_games', '1'],
  ]);

  await initSaveSystem();

  expect(SaveSystem.finishedGames).toBe(1);
  expect(storage.multiGet).toHaveBeenCalledTimes(1);
});

test('falls back to in-memory defaults when hydration fails', async () => {
  jest.clearAllMocks();
  storage.multiGet.mockRejectedValue(new Error('persistence unavailable'));

  await expect(initSaveSystem()).resolves.toBeUndefined();

  expect(SaveSystem.currentLevel).toBe(0);
  expect(SaveSystem.soundOn).toBe(true);
});

test('REWARD-01: failed hydration leaves the reward ledger read-only and writes no reward keys', async () => {
  jest.clearAllMocks();
  storage.multiGet.mockRejectedValue(new Error('persistence unavailable'));

  await initSaveSystem(true, true);
  expect(getRewardState()!.points).toBe(0);
  expect(recordRewardClear('campaign', true)).toBeNull();
  await settlePersistence();

  const writtenKeys = storage.multiSet.mock.calls.flatMap(([pairs]) => pairs.map(([key]) => key));
  expect(writtenKeys.filter(key => key.startsWith('arrows_reward'))).toEqual([]);
});

test('collapses same-microtask writes into one multiSet with the latest values', async () => {
  SaveSystem.setCurrentLevel(3);
  SaveSystem.setCurrentLevel(7);
  SaveSystem.soundOn = false;

  expect(SaveSystem.currentLevel).toBe(7);
  expect(SaveSystem.soundOn).toBe(false);

  await settlePersistence();

  expect(storage.multiSet).toHaveBeenCalledTimes(1);
  expect(storage.multiSet).toHaveBeenCalledWith([
    ['arrows_current_level', '7'],
    ['arrows_sound_on', '0'],
  ]);
  expect(storage.multiRemove).not.toHaveBeenCalled();
});

test('keeps only the final operation for each key in a batch', async () => {
  SaveSystem.setCurrentLevel(9);
  SaveSystem.resetProgress();

  await settlePersistence();

  expect(storage.multiSet).not.toHaveBeenCalled();
  expect(storage.multiRemove).toHaveBeenCalledTimes(1);
  expect(storage.multiRemove).toHaveBeenCalledWith(
    expect.arrayContaining([
      'arrows_current_level',
      'arrows_total_solved',
      'arrows_perfect_streak',
      'arrows_best_perfect_streak',
      'arrows_day_streak',
      'arrows_last_play_day',
    ]),
  );

  jest.clearAllMocks();
  storage.multiSet.mockResolvedValue();
  storage.multiRemove.mockResolvedValue();

  SaveSystem.resetProgress();
  SaveSystem.setCurrentLevel(11);

  await settlePersistence();

  expect(storage.multiSet).toHaveBeenCalledTimes(1);
  expect(storage.multiSet).toHaveBeenCalledWith([['arrows_current_level', '11']]);
  expect(storage.multiRemove).toHaveBeenCalledTimes(1);
  expect(storage.multiRemove).toHaveBeenCalledWith(
    expect.not.arrayContaining(['arrows_current_level']),
  );
});

test('does not start a later batch before the preceding native write completes', async () => {
  let finishFirstWrite!: () => void;
  const firstWrite = new Promise<void>((resolve) => {
    finishFirstWrite = resolve;
  });

  storage.multiSet
    .mockImplementationOnce(() => firstWrite)
    .mockResolvedValueOnce();

  SaveSystem.setCurrentLevel(1);
  await settlePersistence();

  expect(storage.multiSet).toHaveBeenCalledTimes(1);
  expect(storage.multiSet).toHaveBeenNthCalledWith(1, [['arrows_current_level', '1']]);

  SaveSystem.setCurrentLevel(2);
  await settlePersistence();

  expect(storage.multiSet).toHaveBeenCalledTimes(1);

  finishFirstWrite();
  await settlePersistence();

  expect(storage.multiSet).toHaveBeenCalledTimes(2);
  expect(storage.multiSet).toHaveBeenNthCalledWith(2, [['arrows_current_level', '2']]);
});

// ---- P-01: cold start over a Map-backed AsyncStorage ------------------------

const LEGACY_SEED: ReadonlyArray<[string, string]> = [
  ['arrows_current_level', '37'],
  ['arrows_total_solved', '412'],
  ['arrows_perfect_streak', '5'],
  ['arrows_best_perfect_streak', '9'],
  ['arrows_day_streak', '4'],
  ['arrows_last_play_day', '2450'],
  ['arrows_sound_on', '0'],
  ['arrows_dark_mode', '1'],
];

/** Points the AsyncStorage mock at one backing map: multiSet writes it, multiGet reads it. */
function useMapBackedStorage(seed: ReadonlyArray<[string, string]> = []): Map<string, string> {
  const disk = new Map<string, string>(seed);
  jest.clearAllMocks();
  storage.multiGet.mockImplementation(async (keys: readonly string[]) =>
    keys.map((k) => [k, disk.has(k) ? disk.get(k)! : null] as [string, string | null]),
  );
  storage.multiSet.mockImplementation(async (pairs: readonly (readonly [string, string])[]) => {
    for (const [k, v] of pairs) disk.set(k, v);
  });
  storage.multiRemove.mockImplementation(async (keys: readonly string[]) => {
    for (const k of keys) disk.delete(k);
  });
  return disk;
}

/** Runs initSaveSystem and returns the IntStore it installed (reached via a useStore spy). */
async function coldStart(): Promise<IntStore> {
  const spy = jest.spyOn(SaveSystem, 'useStore');
  try {
    await initSaveSystem();
    await settlePersistence();
    expect(spy).toHaveBeenCalledTimes(1);
    return spy.mock.calls[0]![0];
  } finally {
    spy.mockRestore();
  }
}

function assertLegacyGettersMatchSeed(): void {
  expect(SaveSystem.currentLevel).toBe(37);
  expect(SaveSystem.totalSolved).toBe(412);
  expect(SaveSystem.perfectStreak).toBe(5);
  expect(SaveSystem.bestPerfectStreak).toBe(9);
  expect(SaveSystem.soundOn).toBe(false);
  expect(SaveSystem.darkMode).toBe(true);
  // dayStreak depends on today's date, so read the raw day-chain values instead.
}

test('P-01 A3: every registered key survives a cold start; an unregistered key does not', async () => {
  const disk = useMapBackedStorage([['arrows_schema_version', '1']]);
  const first = await coldStart();

  const expected = new Map<string, number>();
  SaveSystem.persistenceKeys.forEach((key, i) => expected.set(key, 1000 + i));
  expected.set('arrows_schema_version', 1);
  expected.set('arrows_shapes_seen_lo', 2 ** 30 - 1);
  expected.set('arrows_shapes_seen_hi', 2 ** 30 - 1);
  expected.set('arrows_tel_install_hi', 2 ** 31 - 1);
  expected.set('arrows_tel_install_lo', 2 ** 31 - 1);
  expected.set('arrows_tel_fatal_hash', 2 ** 32 - 1);
  for (const [key, value] of expected) first.setInt(key, value);
  first.setInt('arrows_unregistered_probe', 4242);
  await settlePersistence();

  // The probe really reached the backing store, so a revert is a hydrate gap.
  expect(disk.get('arrows_unregistered_probe')).toBe('4242');

  const second = await coldStart();
  for (const [key, value] of expected) {
    expect([key, second.getInt(key, -1)]).toEqual([key, value]);
  }
  expect(expected.size).toBe(29);
  // Control: the hazard the registry prevents. Written, flushed, but never hydrated.
  expect(second.getInt('arrows_unregistered_probe', 0)).toBe(0);
});

test('P-01 A4: a legacy save is kept and only stamped with the schema version', async () => {
  const disk = useMapBackedStorage(LEGACY_SEED);

  const s = await coldStart();

  assertLegacyGettersMatchSeed();
  expect(s.getInt('arrows_day_streak', -1)).toBe(4);
  expect(s.getInt('arrows_last_play_day', -1)).toBe(2450);
  expect(SaveSystem.schemaVersion).toBe(1);
  expect(SaveSystem.persistenceHealthy).toBe(true);
  expect(storage.multiSet).toHaveBeenCalledTimes(1);
  expect(storage.multiSet.mock.calls[0]?.[0]).toEqual([['arrows_schema_version', '1']]);
  expect(storage.multiRemove).not.toHaveBeenCalled();
  expect([...disk]).toEqual([...LEGACY_SEED, ['arrows_schema_version', '1']]);
});

test('P-01 A5: a second cold start over the migrated save writes nothing', async () => {
  const disk = useMapBackedStorage(LEGACY_SEED);
  await coldStart();
  const afterFirst = [...disk];
  storage.multiSet.mockClear();
  storage.multiRemove.mockClear();

  await coldStart();

  expect(storage.multiSet).not.toHaveBeenCalled();
  expect(storage.multiRemove).not.toHaveBeenCalled();
  expect([...disk]).toEqual(afterFirst);
});

test('P-01 A6: a save from a newer schema version is inert', async () => {
  const seed: Array<[string, string]> = [...LEGACY_SEED, ['arrows_schema_version', '99']];
  const disk = useMapBackedStorage(seed);

  await coldStart();

  expect(storage.multiSet).not.toHaveBeenCalled();
  expect(storage.multiRemove).not.toHaveBeenCalled();
  assertLegacyGettersMatchSeed();
  expect(SaveSystem.schemaVersion).toBe(99);
  expect([...disk]).toEqual(seed);
});

test('P-01 A7: a failed hydrate marks persistence unhealthy and does not migrate', async () => {
  useMapBackedStorage(LEGACY_SEED);
  await coldStart();
  expect(SaveSystem.persistenceHealthy).toBe(true);

  jest.clearAllMocks();
  storage.multiGet.mockRejectedValue(new Error('persistence unavailable'));
  storage.multiSet.mockResolvedValue();
  storage.multiRemove.mockResolvedValue();

  await expect(initSaveSystem()).resolves.toBeUndefined();
  await settlePersistence();

  expect(SaveSystem.persistenceHealthy).toBe(false);
  expect(storage.multiSet).not.toHaveBeenCalled();
  expect(storage.multiRemove).not.toHaveBeenCalled();
});

test('SAVE-GUARD: after a failed hydrate, play in that session never writes over the saved progress on disk', async () => {
  // A player at level 37. This launch the native read fails (a transient
  // AsyncStorage error), but writes would still reach the disk.
  const disk = useMapBackedStorage(LEGACY_SEED);
  storage.multiGet.mockRejectedValue(new Error('transient read failure'));

  await initSaveSystem();
  await settlePersistence();
  expect(SaveSystem.persistenceHealthy).toBe(false);
  expect(SaveSystem.currentLevel).toBe(0); // in-memory defaults for this session

  // The player clears the level the defaults put them on, and toggles a setting.
  SaveSystem.setCurrentLevel(1);
  SaveSystem.registerSolve(true);
  SaveSystem.soundOn = true;
  await settlePersistence();

  expect(storage.multiSet).not.toHaveBeenCalled();
  expect(storage.multiRemove).not.toHaveBeenCalled();
  expect([...disk]).toEqual(LEGACY_SEED);

  // The next launch reads the disk normally: the real progress is still there.
  storage.multiGet.mockImplementation(async (keys: readonly string[]) =>
    keys.map((k) => [k, disk.has(k) ? disk.get(k)! : null] as [string, string | null]),
  );
  await coldStart();
  assertLegacyGettersMatchSeed();
});

test('W4-02: a live 14-day chain survives hydration and advances with absent freeze keys', async () => {
  const previousClock = SaveSystem.useClock(() => new Date(2026, 8, 20, 12, 0, 0));
  try {
    const today = SaveSystem.today();
    const disk = useMapBackedStorage([
      ['arrows_schema_version', '1'],
      ['arrows_day_streak', '14'],
      ['arrows_last_play_day', String(today - 1)],
    ]);

    await coldStart();

    expect(SaveSystem.dayStreak).toBe(14);
    expect(SaveSystem.streakFreezes).toBe(0);

    SaveSystem.registerSolve(true);
    await settlePersistence();

    expect(SaveSystem.dayStreak).toBe(15);
    expect(SaveSystem.streakFreezes).toBe(0);
    expect(disk.get('arrows_day_streak')).toBe('15');
    expect(disk.get('arrows_streak_freezes')).toBeUndefined();
  } finally {
    SaveSystem.useClock(previousClock);
  }
});

// ---- W4-07: the shape collection over a Map-backed AsyncStorage -------------

describe('W4-07 shape collection across cold starts', () => {
  /** Ground truth from the FULL generator for campaign levels [from, to). */
  function truthMasks(from: number, to: number, start: ShapeMasks = EMPTY_SHAPE_MASKS): ShapeMasks {
    let masks = start;
    for (let i = from; i < to; i += 1) {
      masks = markSeen(masks, catalogueIndexOf(LevelGenerator.generate(i).shapeName));
    }
    return masks;
  }

  const SEEDED: ReadonlyArray<[string, string]> = [...LEGACY_SEED, ['arrows_schema_version', '1']];

  test('level 37, no collection keys: the fold sets exactly levels 0..36 and through = 37, adds two keys, changes none, and a fresh store reads it back', async () => {
    const disk = useMapBackedStorage(SEEDED);
    await coldStart();
    const before = new Map(disk);

    expect(SaveSystem.syncCollection(5000)).toBe(0);
    await settlePersistence();

    const expected = truthMasks(0, 37);
    expect(expected.lo).toBeGreaterThan(0);
    expect(expected.hi).toBe(0); // the 26-id catalogue lives entirely in the low mask
    expect(disk.get('arrows_shapes_seen_lo')).toBe(String(expected.lo));
    expect(disk.get('arrows_shapes_through_level')).toBe('37');
    expect(disk.has('arrows_shapes_seen_hi')).toBe(false); // nothing to OR in: not written
    for (const [key, value] of before) expect([key, disk.get(key)]).toEqual([key, value]);
    expect([...disk.keys()].filter((key) => !before.has(key)).sort()).toEqual([
      'arrows_shapes_seen_lo',
      'arrows_shapes_through_level',
    ]);
    expect(storage.multiRemove).not.toHaveBeenCalled();

    // Cold start: a fresh HydratedIntStore over the same disk.
    const second = await coldStart();
    expect(second.getInt('arrows_shapes_seen_lo', -1)).toBe(expected.lo);
    expect(second.getInt('arrows_shapes_through_level', -1)).toBe(37);
    expect(SaveSystem.shapesSeen).toEqual(expected);
    expect(SaveSystem.shapesThroughLevel).toBe(37);

    // The second launch has nothing to fold and writes nothing.
    storage.multiSet.mockClear();
    expect(SaveSystem.syncCollection(5000)).toBe(0);
    await settlePersistence();
    expect(storage.multiSet).not.toHaveBeenCalled();
    expect(storage.multiRemove).not.toHaveBeenCalled();
  });

  test('fresh install: nothing to fold, and no collection key is written', async () => {
    const disk = useMapBackedStorage([]);
    await coldStart();

    expect(SaveSystem.syncCollection(5000)).toBe(0);
    await settlePersistence();

    expect([...disk.keys()]).toEqual(['arrows_schema_version']);
    expect(storage.multiRemove).not.toHaveBeenCalled();
  });

  // FINAL-FIX (FINAL-REVIEW findings 5 and 15): this used to corrupt the
  // pointer together with the mask, which hid that a corrupt mask under a
  // VALID pointer was never rebuilt. Each case now corrupts ONLY the mask.
  test.each([
    ['a negative number', '-5'],
    ['an unparseable string (hydrate drops it: the key reads as absent)', 'garbage'],
    ['a number beyond 2^53', '99999999999999999999'],
  ])('a corrupt low mask (%s) under a VALID pointer 37 is rebuilt from the generator on the next fold', async (_, raw) => {
    const disk = useMapBackedStorage([
      ...SEEDED,
      ['arrows_shapes_seen_lo', raw],
      ['arrows_shapes_through_level', '37'],
    ]);
    await coldStart();

    expect(SaveSystem.shapesSeen).toEqual({ lo: 0, hi: 0 });
    expect(SaveSystem.shapesThroughLevel).toBe(0); // the pointer cannot vouch for bits it cannot see
    expect(SaveSystem.syncCollection(5000)).toBe(0);
    await settlePersistence();

    expect(disk.get('arrows_shapes_seen_lo')).toBe(String(truthMasks(0, 37).lo));
    expect(disk.get('arrows_shapes_through_level')).toBe('37');
    expect(storage.multiRemove).not.toHaveBeenCalled();
  });

  test('a corrupt low mask under a valid pointer, then a campaign clear before any fold: the clear defers and the next cold start still ends at the truth', async () => {
    const disk = useMapBackedStorage([
      ...SEEDED,
      ['arrows_shapes_seen_lo', '-5'],
      ['arrows_shapes_through_level', '37'],
    ]);
    await coldStart();

    SaveSystem.setCurrentLevel(38);
    expect(SaveSystem.recordCampaignClear(37)).toEqual({ newlyDiscovered: false });
    await settlePersistence();
    expect(disk.get('arrows_shapes_seen_lo')).toBe('-5'); // not overwritten with "0 + one bit"

    await coldStart();
    expect(SaveSystem.syncCollection(5000)).toBe(0);
    await settlePersistence();
    expect(disk.get('arrows_shapes_seen_lo')).toBe(String(truthMasks(0, 38).lo));
    expect(disk.get('arrows_shapes_through_level')).toBe('38');
  });

  test('an unparseable pointer over a valid mask refolds from level 0 and ends at the truth', async () => {
    const disk = useMapBackedStorage([
      ...SEEDED,
      ['arrows_shapes_seen_lo', String(truthMasks(0, 37).lo)],
      ['arrows_shapes_through_level', 'garbage'],
    ]);
    await coldStart();

    expect(SaveSystem.shapesThroughLevel).toBe(0);
    SaveSystem.syncCollection(5000);
    await settlePersistence();

    expect(disk.get('arrows_shapes_seen_lo')).toBe(String(truthMasks(0, 37).lo));
    expect(disk.get('arrows_shapes_through_level')).toBe('37');
  });

  test('bits a FUTURE catalogue wrote (index 29 in lo, index 55 in hi) survive the fold untouched', async () => {
    const disk = useMapBackedStorage([
      ...SEEDED,
      ['arrows_shapes_seen_lo', String(1 << 29)],
      ['arrows_shapes_seen_hi', String(1 << 25)],
      ['arrows_shapes_through_level', '0'],
    ]);
    await coldStart();

    SaveSystem.syncCollection(5000);
    await settlePersistence();

    const expected = truthMasks(0, 37, { lo: 1 << 29, hi: 1 << 25 });
    expect(disk.get('arrows_shapes_seen_lo')).toBe(String(expected.lo));
    expect(expected.lo & (1 << 29)).toBe(1 << 29);
    expect(disk.get('arrows_shapes_seen_hi')).toBe(String(1 << 25));
    expect(disk.get('arrows_shapes_through_level')).toBe('37');
  });

  test('a failed hydrate leaves the collection on disk untouched (no fold over defaults)', async () => {
    const seed: Array<[string, string]> = [
      ...SEEDED,
      ['arrows_shapes_seen_lo', '1023'],
      ['arrows_shapes_through_level', '37'],
    ];
    const disk = useMapBackedStorage(seed);
    storage.multiGet.mockRejectedValue(new Error('persistence unavailable'));
    await coldStart();
    expect(SaveSystem.persistenceHealthy).toBe(false);

    SaveSystem.syncCollection(5000);
    SaveSystem.setCurrentLevel(1);
    SaveSystem.recordCampaignClear(0);
    await settlePersistence();

    expect(disk.get('arrows_shapes_seen_lo')).toBe('1023');
    expect(disk.get('arrows_shapes_through_level')).toBe('37');
    // SAVE-GUARD: after a failed hydrate nothing reaches the disk at all (this
    // test used to pin the arrows_current_level overwrite W4-07 found).
    const writtenKeys = storage.multiSet.mock.calls.flatMap(([pairs]) => pairs.map(([key]) => key));
    expect(writtenKeys).toEqual([]);
    expect(disk.get('arrows_current_level')).toBe(seed.find(([key]) => key === 'arrows_current_level')?.[1]);
  });
});

// ---- W3-05: the generator switch level stamped at boot, over AsyncStorage ---

describe('W3-05 boot classification of the generator switch level', () => {
  const KEY = 'arrows_gen_switch_level';

  /** Every key any multiSet call wrote since the last clearAllMocks. */
  function writtenKeys(): string[] {
    return storage.multiSet.mock.calls.flatMap(([pairs]) => pairs.map(([key]) => key));
  }

  const LEVEL_40: ReadonlyArray<[string, string]> = [
    ['arrows_schema_version', '1'],
    ['arrows_current_level', '40'],
    ['arrows_total_solved', '40'],
  ];

  test('a save at arrows_current_level = 40, flag forced ON: the real initSaveSystem then the stamp writes 41', async () => {
    const disk = useMapBackedStorage(LEVEL_40);
    await coldStart();

    expect(stampGenSwitchLevel(SaveSystem, true)).toBe(41);
    await settlePersistence();

    // A stamp that ran before hydration would have read level 0 and written 0 or 1.
    expect(disk.get(KEY)).toBe('41');
    expect(storage.multiSet.mock.calls).toEqual([[[[KEY, '41']]]]);
    expect(SaveSystem.genSwitchLevel).toBe(41);

    // A fresh HydratedIntStore over the same disk reads the stamp back.
    await coldStart();
    expect(SaveSystem.genSwitchLevel).toBe(41);
  });

  test('ordering hazard: a stamp attempted while initSaveSystem is still hydrating writes nothing', async () => {
    const disk = useMapBackedStorage(LEVEL_40);

    const booting = initSaveSystem();
    // initSaveSystem marks persistence unhealthy before its read resolves.
    expect(SaveSystem.persistenceHealthy).toBe(false);
    expect(stampGenSwitchLevel(SaveSystem, true)).toBeNull();
    await booting;
    await settlePersistence();
    expect(writtenKeys()).not.toContain(KEY);
    expect(disk.has(KEY)).toBe(false);

    // Once hydrated, the same call classifies the real save.
    expect(stampGenSwitchLevel(SaveSystem, true)).toBe(41);
    await settlePersistence();
    expect(disk.get(KEY)).toBe('41');
  });

  test('a fresh install, flag forced ON, writes 0', async () => {
    const disk = useMapBackedStorage([]);
    await coldStart();

    expect(stampGenSwitchLevel(SaveSystem, true)).toBe(0);
    await settlePersistence();

    expect(disk.get(KEY)).toBe('0');
    expect(SaveSystem.genSwitchLevel).toBe(0);
  });

  test('the shipped flag (OFF) writes nothing: no multiSet contains the key', async () => {
    const disk = useMapBackedStorage(LEVEL_40);
    await coldStart();

    expect(stampGenSwitchLevel(SaveSystem)).toBeNull();
    await settlePersistence();

    expect(writtenKeys()).not.toContain(KEY);
    expect(disk.has(KEY)).toBe(false);
    expect(SaveSystem.genSwitchLevel).toBeNull();
  });

  test('a present key is never rewritten on a later boot, even after the player moved on', async () => {
    const disk = useMapBackedStorage(LEVEL_40);
    await coldStart();
    expect(stampGenSwitchLevel(SaveSystem, true)).toBe(41);
    SaveSystem.setCurrentLevel(45); // five more clears this session
    await settlePersistence();

    storage.multiSet.mockClear();
    await coldStart();
    expect(stampGenSwitchLevel(SaveSystem, true)).toBeNull();
    await settlePersistence();

    expect(writtenKeys()).not.toContain(KEY);
    expect(disk.get(KEY)).toBe('41');
    expect(SaveSystem.genSwitchLevel).toBe(41);
  });

  test('a stored -5 reads as null and is not rewritten', async () => {
    const disk = useMapBackedStorage([...LEVEL_40, [KEY, '-5']]);
    await coldStart();

    expect(SaveSystem.genSwitchLevel).toBeNull();
    expect(stampGenSwitchLevel(SaveSystem, true)).toBeNull();
    await settlePersistence();

    expect(writtenKeys()).not.toContain(KEY);
    expect(disk.get(KEY)).toBe('-5');
  });

  test('a failed hydrate stamps nothing (SAVE-GUARD / persistenceHealthy)', async () => {
    const disk = useMapBackedStorage(LEVEL_40);
    storage.multiGet.mockRejectedValue(new Error('persistence unavailable'));
    await coldStart();
    expect(SaveSystem.persistenceHealthy).toBe(false);

    expect(stampGenSwitchLevel(SaveSystem, true)).toBeNull();
    await settlePersistence();

    expect(writtenKeys()).toEqual([]);
    expect(disk.has(KEY)).toBe(false);
    expect(SaveSystem.genSwitchLevel).toBeNull();
  });
});
