// PETAL-ADS-01: the two petal-ad keys are hydrated only when petal ads are on (book on too).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initSaveSystem } from '../storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getAllKeys: jest.fn(), multiGet: jest.fn(), multiSet: jest.fn(), multiRemove: jest.fn() },
}));
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const PETAL_AD_KEYS = ['arrows_petal_ads_day', 'arrows_petal_ads_count'];

async function hydratedKeys(...args: Parameters<typeof initSaveSystem>): Promise<string[]> {
  jest.resetAllMocks();
  storage.multiGet.mockResolvedValue([['arrows_schema_version', '1']]);
  storage.multiSet.mockResolvedValue();
  storage.multiRemove.mockResolvedValue();
  await initSaveSystem(...args);
  for (let i = 0; i < 6; i++) await Promise.resolve();
  return storage.multiGet.mock.calls.flatMap(([keys]) => [...keys]);
}
const written = () => storage.multiSet.mock.calls.flatMap(([pairs]) => pairs.map(([k]) => k));

test('control: book on, petal ads off: the petal-ad keys are neither read nor written', async () => {
  const keys = await hydratedKeys(true, true, true, false, false);
  expect(keys).toContain('arrows_petals');
  expect(keys.filter(k => PETAL_AD_KEYS.includes(k))).toEqual([]);
  expect(written().filter(k => PETAL_AD_KEYS.includes(k))).toEqual([]);
});

test('petal ads on (with the book): both keys are hydrated in the one boot read, and boot writes neither', async () => {
  const keys = await hydratedKeys(true, true, true, false, true);
  expect(storage.multiGet).toHaveBeenCalledTimes(1);
  expect(keys).toEqual(expect.arrayContaining(PETAL_AD_KEYS));
  expect(written().filter(k => PETAL_AD_KEYS.includes(k))).toEqual([]);
});

test('petal ads asked for without the book: not hydrated', async () => {
  const keys = await hydratedKeys(true, true, false, false, true);
  expect(keys.filter(k => PETAL_AD_KEYS.includes(k))).toEqual([]);
});
