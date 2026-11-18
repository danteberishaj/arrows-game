/** WINTER-01 ambience gate: flag, winter season (QA date honoured), sound toggle, foreground, variant swap. */
type Player = {
  source: unknown;
  loop: boolean;
  volume: number;
  play: jest.Mock;
  pause: jest.Mock;
  replace: jest.Mock;
};

function load(env: { flag?: boolean; qaDate?: string; now: string }) {
  jest.resetModules();
  jest.useFakeTimers();
  jest.setSystemTime(new Date(env.now));
  process.env.EXPO_PUBLIC_META_AMBIENCE = env.flag === false ? '0' : '1';
  process.env.EXPO_PUBLIC_QA_DATE = env.qaDate ?? '';
  const players: Player[] = [];
  const createAudioPlayer = jest.fn((source: unknown) => {
    const p: Player = {
      source,
      loop: false,
      volume: 1,
      play: jest.fn(),
      pause: jest.fn(),
      replace: jest.fn((s: unknown) => {
        p.source = s;
      }),
    };
    players.push(p);
    return p;
  });
  for (const n of ['fireside', 'musicbox', 'wind-bells']) {
    jest.doMock(`../../../assets/audio/ambience/winter-${n}.m4a`, () => `asset:${n}`);
  }
  jest.doMock('expo-audio', () => ({ createAudioPlayer, setAudioModeAsync: jest.fn(() => Promise.resolve()) }));
  const { AppState } = require('react-native');
  let appListener: ((s: string) => void) | null = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, fn: (s: string) => void) => {
    appListener = fn;
    return { remove: jest.fn() };
  }) as never);
  const amb = require('../ambience') as typeof import('../ambience');
  amb.resetAmbienceForTests();
  return { amb, players, createAudioPlayer, appState: (s: string) => appListener?.(s) };
}

afterEach(() => {
  jest.useRealTimers();
  delete process.env.EXPO_PUBLIC_META_AMBIENCE;
  delete process.env.EXPO_PUBLIC_QA_DATE;
});

const DEC = '2026-12-10T12:00:00';
const NOV = '2026-11-18T12:00:00';

test('flag off: no player is ever created', () => {
  const { amb, createAudioPlayer } = load({ flag: false, now: DEC });
  amb.syncAmbience(true);
  expect(createAudioPlayer).not.toHaveBeenCalled();
});

test('out of season or sound off: no player', () => {
  const a = load({ now: NOV });
  a.amb.syncAmbience(true);
  expect(a.createAudioPlayer).not.toHaveBeenCalled();
  const b = load({ now: DEC });
  b.amb.syncAmbience(false);
  expect(b.createAudioPlayer).not.toHaveBeenCalled();
});

test('season window wraps the year and ends on Feb 29', () => {
  for (const [now, plays] of [
    ['2026-11-30T12:00:00', false],
    ['2026-12-01T00:30:00', true],
    ['2027-01-15T12:00:00', true],
    ['2028-02-29T12:00:00', true],
    ['2027-03-01T12:00:00', false],
  ] as const) {
    const { amb, createAudioPlayer } = load({ now });
    amb.syncAmbience(true);
    expect([now, createAudioPlayer.mock.calls.length > 0]).toEqual([now, plays]);
  }
});

test('in season with sound on: loops, fades in to ~0.35 over ~1.5 s', () => {
  const { amb, players } = load({ now: DEC });
  amb.syncAmbience(true);
  const p = players[0];
  expect(p.loop).toBe(true);
  expect(p.play).toHaveBeenCalledTimes(1);
  expect(p.volume).toBe(0);
  jest.advanceTimersByTime(750);
  expect(p.volume).toBeGreaterThan(0.1);
  expect(p.volume).toBeLessThan(0.3);
  jest.advanceTimersByTime(800);
  expect(p.volume).toBeCloseTo(amb.AMBIENCE_VOLUME);
});

test('toggling sound off fades out and pauses within ~0.6 s; on again resumes', () => {
  const { amb, players } = load({ now: DEC });
  amb.syncAmbience(true);
  jest.advanceTimersByTime(2000);
  const p = players[0];
  amb.syncAmbience(false);
  jest.advanceTimersByTime(650);
  expect(p.volume).toBe(0);
  expect(p.pause).toHaveBeenCalledTimes(1);
  amb.syncAmbience(true);
  expect(p.play).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(1600);
  expect(p.volume).toBeCloseTo(amb.AMBIENCE_VOLUME);
  expect(players).toHaveLength(1);
});

test('background pauses at once; active resumes', () => {
  const { amb, players, appState } = load({ now: DEC });
  amb.syncAmbience(true);
  jest.advanceTimersByTime(2000);
  const p = players[0];
  appState('background');
  expect(p.pause).toHaveBeenCalledTimes(1);
  expect(p.volume).toBe(0);
  appState('active');
  expect(p.play).toHaveBeenCalledTimes(2);
});

test('variant switch swaps the source on the live player', () => {
  const { amb, players } = load({ now: DEC });
  expect(amb.ambienceVariants()).toHaveLength(3);
  expect(amb.ambienceVariants().every((n) => typeof n === 'string' && n.length > 0)).toBe(true);
  amb.syncAmbience(true);
  const p = players[0];
  expect(p.source).toBe('asset:fireside');
  amb.setAmbienceVariant(2);
  expect(p.replace).toHaveBeenCalledTimes(1);
  expect(p.source).toBe('asset:wind-bells');
  expect(p.play).toHaveBeenCalledTimes(2);
  expect(amb.getAmbienceVariant()).toBe(2);
  amb.setAmbienceVariant(-1); // wraps to the last
  expect(amb.getAmbienceVariant()).toBe(2);
  expect(p.replace).toHaveBeenCalledTimes(1);
});

test('QA date honoured: November clock + QA December date plays', () => {
  const { amb, createAudioPlayer } = load({ now: NOV, qaDate: '2026-12-10' });
  amb.syncAmbience(true);
  expect(createAudioPlayer).toHaveBeenCalledTimes(1);
});

test('expo-audio missing (installed Android build): silent, no throw', () => {
  const { amb } = load({ now: DEC });
  jest.resetModules();
  jest.doMock('expo-audio', () => {
    throw new Error("Cannot find native module 'ExpoAudio'");
  });
  const fresh = require('../ambience') as typeof import('../ambience');
  fresh.resetAmbienceForTests();
  expect(() => fresh.syncAmbience(true)).not.toThrow();
  expect(amb).toBeDefined();
});
