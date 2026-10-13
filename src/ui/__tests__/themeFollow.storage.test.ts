/**
 * TF-01 A (META_THEME_SYSTEM) through the REAL hydrate path: AsyncStorage (a Map-backed mock) -> initSaveSystem ->
 * HydratedIntStore -> SaveSystem -> bootTheme, the call App.tsx makes once hydration settles. Two fixtures:
 * - a save shaped like the current release (every legacy key, arrows_dark_mode = 1, progress, no new key);
 * - a fresh, empty store.
 * Plus the flags-default boot: the key is never written.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SaveSystem } from '../../core';
import { initSaveSystem } from '../storage';
import { bootTheme } from '../themeFollow';

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
const KEY = 'arrows_theme_follows_system';

async function settlePersistence(): Promise<void> {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

function useMapBackedStorage(seed: ReadonlyArray<[string, string]> = []): Map<string, string> {
  const disk = new Map<string, string>(seed);
  jest.resetAllMocks();
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

/** Every legacy key of a shipped release save (the P-01 storage test's LEGACY_SEED) plus the release's P-01 keys. */
const RELEASE_SAVE: ReadonlyArray<[string, string]> = [
  ['arrows_current_level', '37'],
  ['arrows_total_solved', '412'],
  ['arrows_perfect_streak', '5'],
  ['arrows_best_perfect_streak', '9'],
  ['arrows_day_streak', '4'],
  ['arrows_last_play_day', '2450'],
  ['arrows_sound_on', '0'],
  ['arrows_dark_mode', '1'],
  ['arrows_schema_version', '1'],
  ['arrows_ftue_stage', '3'],
  ['arrows_finished_games', '1'],
];

async function boot(enabled: boolean, scheme: string | null) {
  await initSaveSystem();
  const theme = bootTheme(SaveSystem, enabled, scheme);
  await settlePersistence();
  return theme;
}

test('the new key is registered (P-01 row 30), so the real hydrate reads it back', () => {
  expect(SaveSystem.persistenceKeys).toContain(KEY);
  expect(SaveSystem.persistenceKeys.at(-1)).toBe(KEY);
});

test('release-shaped save, flag ON, light phone: dark stays on and the stamp is 0', async () => {
  const disk = useMapBackedStorage(RELEASE_SAVE);
  const theme = await boot(true, 'light');
  expect(SaveSystem.persistenceHealthy).toBe(true);
  expect(theme).toEqual({ dark: true, followsSystem: false });
  expect(disk.get(KEY)).toBe('0');
  expect(disk.get('arrows_dark_mode')).toBe('1');
  // Every other key is exactly as it was.
  expect([...disk].filter(([k]) => k !== KEY)).toEqual(RELEASE_SAVE);
  // A second cold start reads the stamp back and keeps the player's theme; nothing more is written.
  storage.multiSet.mockClear();
  const again = await boot(true, 'dark');
  expect(again).toEqual({ dark: true, followsSystem: false });
  expect(storage.multiSet).not.toHaveBeenCalled();
});

test('fresh empty store, flag ON: stamps 1 and follows the phone', async () => {
  const disk = useMapBackedStorage();
  const theme = await boot(true, 'dark');
  expect(theme).toEqual({ dark: true, followsSystem: true });
  expect(disk.get(KEY)).toBe('1');
  expect(disk.has('arrows_dark_mode')).toBe(false);
  // Cold start 2 on a light phone: still following (no restamp), now light.
  storage.multiSet.mockClear();
  expect(await boot(true, 'light')).toEqual({ dark: false, followsSystem: true });
  expect(storage.multiSet).not.toHaveBeenCalled();
});

test('flags default (OFF): boot never writes the key, on a fresh store or a release save', async () => {
  for (const seed of [[], RELEASE_SAVE] as const) {
    const disk = useMapBackedStorage(seed);
    const theme = await boot(false, 'dark');
    expect(theme.followsSystem).toBe(false);
    expect(theme.dark).toBe(seed.length > 0);
    expect(disk.has(KEY)).toBe(false);
    const written = storage.multiSet.mock.calls.flatMap((c) => c[0].map(([k]) => k));
    expect(written).not.toContain(KEY);
  }
});

test('a failed hydrate, flag ON: no stamp, not following (P-01 rule for derived values)', async () => {
  useMapBackedStorage();
  storage.multiGet.mockRejectedValue(new Error('read failed'));
  const theme = await boot(true, 'dark');
  expect(SaveSystem.persistenceHealthy).toBe(false);
  expect(theme).toEqual({ dark: false, followsSystem: false });
  expect(storage.multiSet).not.toHaveBeenCalled();
});
