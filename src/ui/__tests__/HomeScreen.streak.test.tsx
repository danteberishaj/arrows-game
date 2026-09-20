import { render } from '@testing-library/react-native';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { HomeScreen } from '../HomeScreen';
import { Daylight, InkNight } from '../theme';

/**
 * Override only META_STREAK_FREEZE, keeping every other flag's real compiled value, so
 * CONSENT_GATE, REMOTE_KILL_SWITCH and TELEMETRY_TRANSPORT read the same as they would outside
 * this test instead of `undefined`.
 *
 * Fix-round-1 decision: the brief named the env-var + `jest.isolateModules` pattern from
 * `src/core/__tests__/saveSystem.test.ts`'s "W4-02 SaveSystem day-chain wiring" block (lines
 * 313-354). That pattern is safe there because that block never renders a React tree. Applied
 * literally here it broke: `jest.isolateModules` forks the *whole* module registry, so the
 * freshly-required `HomeScreen` pulled in a second, separate copy of `react` than the one
 * `@testing-library/react-native`'s `render()` (imported at file scope, since that module
 * registers global Jest hooks at load time and cannot be required mid-test) uses internally.
 * HomeScreen's own `useSafeAreaInsets()` then read a null dispatcher from its copy of `react`
 * that the renderer never set up, and the test failed with
 * "TypeError: Cannot read properties of null (reading 'useContext')" — confirmed by running it.
 * `jest.mock` with a `requireActual` spread reaches the same goal (only the one flag overridden)
 * without forking the module registry, so `react` stays a single instance.
 */
jest.mock('../../featureFlags', () => ({
  ...jest.requireActual('../../featureFlags'),
  META_STREAK_FREEZE: true,
}));

class MapStore implements IntStore {
  readonly map = new Map<string, number>();

  getInt(key: string, defaultValue: number): number {
    return this.map.get(key) ?? defaultValue;
  }

  setInt(key: string, value: number): void {
    this.map.set(key, value);
  }

  deleteKey(key: string): void {
    this.map.delete(key);
  }
}

const props = {
  palette: Daylight,
  dark: false,
  soundOn: true,
  onPlay: jest.fn(),
  onToggleSound: jest.fn(),
  onToggleTheme: jest.fn(),
};

let store: MapStore;
let previousStore: IntStore;
let previousClock: () => Date;

beforeEach(() => {
  store = new MapStore();
  previousStore = SaveSystem.useStore(store);
  previousClock = SaveSystem.useClock(() => new Date(2026, 8, 20, 12, 0, 0));
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  SaveSystem.useClock(previousClock);
});

test('one solve keeps the stats line free of streak text', () => {
  store.setInt('arrows_total_solved', 1);
  store.setInt('arrows_day_streak', 1);
  store.setInt('arrows_last_play_day', SaveSystem.today());

  const menu = render(<HomeScreen {...props} />);

  expect(menu.getByText('1 puzzle solved')).toBeTruthy();
  expect(menu.queryByText(/streak/)).toBeNull();
});

test('streak saved stays for one mount through a theme change, then is consumed', () => {
  const today = SaveSystem.today();
  store.setInt('arrows_total_solved', 15);
  store.setInt('arrows_day_streak', 15);
  store.setInt('arrows_last_play_day', today);
  store.setInt('arrows_streak_saved_day', today);

  const firstMenu = render(<HomeScreen {...props} />);

  expect(firstMenu.getAllByText(/streak saved/)).toHaveLength(1);
  expect(SaveSystem.streakSavedDay).toBe(0);

  firstMenu.rerender(<HomeScreen {...props} palette={InkNight} dark />);
  expect(firstMenu.getAllByText(/streak saved/)).toHaveLength(1);
  firstMenu.unmount();

  const nextMenu = render(<HomeScreen {...props} />);
  expect(nextMenu.queryByText(/streak saved/)).toBeNull();
  expect(nextMenu.getByText(/15-day streak/)).toBeTruthy();
});
