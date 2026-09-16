import AsyncStorage from '@react-native-async-storage/async-storage';
import { SaveSystem, type IntStore } from '../../core';
import { initSaveSystem } from '../storage';

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

test('falls back to in-memory defaults when hydration fails', async () => {
  jest.clearAllMocks();
  storage.multiGet.mockRejectedValue(new Error('persistence unavailable'));

  await expect(initSaveSystem()).resolves.toBeUndefined();

  expect(SaveSystem.currentLevel).toBe(0);
  expect(SaveSystem.soundOn).toBe(true);
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
