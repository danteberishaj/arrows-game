import AsyncStorage from '@react-native-async-storage/async-storage';
import { SaveSystem } from '../../core';
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
  storage.multiGet.mockResolvedValue([]);
  storage.multiSet.mockResolvedValue();
  storage.multiRemove.mockResolvedValue();
  await initSaveSystem();
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
