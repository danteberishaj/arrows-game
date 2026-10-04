import AsyncStorage from '@react-native-async-storage/async-storage';
import { ARROW_STYLES } from '../skinSpecs';
import { SaveSystem } from '../../core/saveSystem';
import { initSaveSystem, initSkinPickerCapture } from '../storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true, default: { multiGet: jest.fn(), multiSet: jest.fn(), multiRemove: jest.fn() },
}));
// Require through the public storage entry point so the pre-picker base reaches the failing assertions.
const selection = require('../storage') as {
  getArrowStyle: () => { id: string; numericId: number };
  chooseArrowStyle: (id: string) => void;
};
const diskApi = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function seed(extra: [string, string][] = []) {
  const disk = new Map(SaveSystem.persistenceKeys.map((key, i) => [key, String(i + 101)]));
  disk.set('arrows_schema_version', '1');
  extra.forEach(([k,v]) => disk.set(k,v));
  jest.clearAllMocks();
  diskApi.multiGet.mockImplementation(async keys => keys.map(key => [key, disk.get(key) ?? null]));
  diskApi.multiSet.mockImplementation(async pairs => { pairs.forEach(([k,v]) => disk.set(k,v)); });
  diskApi.multiRemove.mockImplementation(async keys => { keys.forEach(k => disk.delete(k)); });
  return disk;
}
const boot = async (enabled: boolean) => {
  await (initSaveSystem as (enabled?: boolean) => Promise<void>)(enabled);
  await settle();
};
it.each([false, true])('all 29 existing keys round-trip byte-for-byte with picker %s', async enabled => {
  const disk = seed(); const before = new Map(disk);
  await boot(enabled);
  if (enabled) { selection.chooseArrowStyle('cinnamon'); await settle(); }
  await boot(enabled);
  for (const [key,value] of before) expect([key,disk.get(key)]).toEqual([key,value]);
  expect(before.size).toBe(29);
  expect(diskApi.multiRemove).not.toHaveBeenCalled();
  if (enabled) expect(diskApi.multiSet.mock.calls).toEqual([[[['arrows_skin','1']]]]);
  else expect(diskApi.multiSet).not.toHaveBeenCalled();
});
it('choose → save → restart keeps a stable id; repeated choice writes nothing', async () => {
  const disk = seed(); await boot(true);
  expect(selection.getArrowStyle().id).toBe('classic');
  selection.chooseArrowStyle('sherbet'); selection.chooseArrowStyle('sherbet'); await settle();
  expect(disk.get('arrows_skin')).toBe('2');
  expect(diskApi.multiSet.mock.calls).toEqual([[[['arrows_skin','2']]]]);
  await boot(true);
  expect(selection.getArrowStyle().id).toBe('sherbet');
  expect(diskApi.multiGet.mock.calls.at(-1)?.[0].filter(k => k === 'arrows_skin')).toHaveLength(1);
});
it.each(['99', '-1', 'garbage', '1.5', '1bad'])('unknown/removed/malformed id %s falls back without rewriting it', async raw => {
  const disk = seed([['arrows_skin',raw]]); await boot(true);
  expect(selection.getArrowStyle().id).toBe('classic');
  expect(disk.get('arrows_skin')).toBe(raw);
  expect(diskApi.multiSet).not.toHaveBeenCalled();
});
it('SAVE-GUARD: failed hydrate never writes the new or existing keys', async () => {
  const disk = seed([['arrows_skin','2']]); const before = [...disk];
  diskApi.multiGet.mockRejectedValue(new Error('failed read'));
  await boot(true); selection.chooseArrowStyle('cinnamon'); SaveSystem.setCurrentLevel(1); await settle();
  expect(diskApi.multiSet).not.toHaveBeenCalled();
  expect([...disk]).toEqual(before);
});
it('uninstall-free downgrade ignores the key and cannot write through a stale selection callback', async () => {
  const disk = seed([['arrows_skin','2']]); const before = [...disk];
  await boot(true); expect(selection.getArrowStyle().id).toBe('sherbet');
  await boot(false); selection.chooseArrowStyle('cinnamon'); await settle();
  expect(selection.getArrowStyle().id).toBe('classic');
  expect(diskApi.multiGet.mock.calls.at(-1)?.[0]).toEqual(SaveSystem.persistenceKeys);
  expect(diskApi.multiSet).not.toHaveBeenCalled(); expect([...disk]).toEqual(before);
});


it('PERF capture reads only arrows_skin and never installs/migrates a progress store', async () => {
  const disk = seed([['arrows_skin','2']]); const before = new Map(disk);
  const store = jest.spyOn(SaveSystem, 'useStore'); const migrate = jest.spyOn(SaveSystem, 'migrate');
  try {
    await initSkinPickerCapture(); selection.chooseArrowStyle('cinnamon'); await settle();
    expect(diskApi.multiGet.mock.calls).toEqual([[['arrows_skin']]]);
    expect(diskApi.multiSet.mock.calls).toEqual([[[['arrows_skin','1']]]]);
    expect(store).not.toHaveBeenCalled(); expect(migrate).not.toHaveBeenCalled();
    for (const key of SaveSystem.persistenceKeys) expect(disk.get(key)).toBe(before.get(key));
  } finally { store.mockRestore(); migrate.mockRestore(); }
});
it('PERF capture preserves the unread preference after a failed read', async () => {
  const disk = seed([['arrows_skin','2']]); const before = [...disk];
  diskApi.multiGet.mockRejectedValue(new Error('failed capture read'));
  await initSkinPickerCapture(); selection.chooseArrowStyle('cinnamon'); await settle();
  expect(diskApi.multiSet).not.toHaveBeenCalled(); expect([...disk]).toEqual(before);
});

// Append-only catalogue entries use the same additive key and survive a fresh hydrate. Seasonal styles (HALLOWEEN-01)
// are selectable only with seasons on: covered below.
const seasonalIds: readonly number[] = require('../rewardCatalogue').SEASONAL_REWARD_IDS;
it.each(ARROW_STYLES.filter(s => !seasonalIds.includes(s.numericId)).map(s => [s.id, s.numericId] as const))('catalogue %s persists numeric id %i without changing progress', async (id, numericId) => {
  const disk = seed(); const before = new Map(disk); await boot(true);
  selection.chooseArrowStyle(id); await settle(); await boot(true);
  expect(selection.getArrowStyle().numericId).toBe(numericId);
  for(const key of SaveSystem.persistenceKeys) expect(disk.get(key)).toBe(before.get(key));
});

it.each(ARROW_STYLES.filter(s => seasonalIds.includes(s.numericId)).map(s => [s.id, s.numericId] as const))(
  'seasonal %s persists numeric id %i with seasons on, and an off build reads it as Classic without rewriting', async (id, numericId) => {
  const disk = seed(); const before = new Map(disk);
  await initSaveSystem(true, true, true, true); await settle();
  selection.chooseArrowStyle(id); await settle();
  await initSaveSystem(true, true, true, true); await settle();
  expect(selection.getArrowStyle().numericId).toBe(numericId);
  for(const key of SaveSystem.persistenceKeys) expect(disk.get(key)).toBe(before.get(key));
  const saved = disk.get('arrows_skin');
  await initSaveSystem(true, true, true, false); await settle();
  expect(selection.getArrowStyle().id).toBe('classic');
  expect(disk.get('arrows_skin')).toBe(saved);
});
