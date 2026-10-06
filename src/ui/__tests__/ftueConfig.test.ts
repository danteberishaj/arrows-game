/**
 * W1-11 (owner answers 2026-10-06, docs/owner-rulings-2026-10-06.md Q2): FTUE_ENABLED is ON in every build that does
 * not opt out (EXPO_PUBLIC_FTUE=0). The assist (ruling I-27: waits for W3-17) and the stall hint (owner: OFF) keep
 * their default-OFF opt-in, and the stall-hint delay stays unset.
 */

type FtueConfig = typeof import('../ftueConfig');

const savedEnv = { ...process.env };

function loadConfig(env: Record<string, string | undefined>): FtueConfig {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('EXPO_PUBLIC_FTUE')) delete process.env[key];
  }
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) process.env[key] = value;
  }
  let config!: FtueConfig;
  jest.isolateModules(() => {
    config = require('../ftueConfig') as FtueConfig;
  });
  return config;
}

afterEach(() => {
  process.env = { ...savedEnv };
});

test('a build that sets no FTUE variable has the tutorial ON (W1-11 flip)', () => {
  expect(loadConfig({}).FTUE_ENABLED).toBe(true);
});

test('EXPO_PUBLIC_FTUE=0 is the explicit way to turn the tutorial off', () => {
  expect(loadConfig({ EXPO_PUBLIC_FTUE: '0' }).FTUE_ENABLED).toBe(false);
});

test('the legacy opt-in value 1 still means ON', () => {
  expect(loadConfig({ EXPO_PUBLIC_FTUE: '1' }).FTUE_ENABLED).toBe(true);
});

test('the assist and the stall hint stay OFF by default, and the stall delay stays unset', () => {
  const config = loadConfig({});
  expect(config.FTUE_ASSIST_ENABLED).toBe(false);
  expect(config.FTUE_STALL_HINT_ENABLED).toBe(false);
  expect(config.FTUE_STALL_HINT_MS).toBeNull();
});

test('the assist and the stall hint still opt in only with their own variable', () => {
  const config = loadConfig({ EXPO_PUBLIC_FTUE_ASSIST: '1', EXPO_PUBLIC_FTUE_STALL_HINT: '1' });
  expect(config.FTUE_ASSIST_ENABLED).toBe(true);
  expect(config.FTUE_STALL_HINT_ENABLED).toBe(true);
  expect(loadConfig({ EXPO_PUBLIC_FTUE: '0' }).FTUE_ASSIST_ENABLED).toBe(false);
});
