/**
 * ADMOB-C (ruling M4): the menu banner as the menu renders it.
 * - META_BANNER off: no banner, and the ad module is never asked.
 * - Not allowed (killed / declined / SDK not ready): nothing rendered.
 * - Allowed: the banner mounts at the bottom inset but reserves no space until
 *   an ad has loaded; then the stats line moves above it.
 * - A withdrawal or kill (the store flips to not allowed) removes it at once.
 * - While the player is still in the tutorial the menu shows no banner.
 * Layout and pixels are NOT verified here (jest cannot): emulator screenshots
 * in artifacts/ADMOB-C/ close that.
 */
import { act, render } from '@testing-library/react-native';
import React from 'react';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { HomeScreen } from '../HomeScreen';
import { Daylight } from '../theme';

const mockFlags = { META_BANNER: true };
// Only META_BANNER is overridden (every other flag keeps its compiled value), as
// a getter defined without evaluating it: jest.mock is hoisted above the
// `mockFlags` declaration, so the value is read only while a test runs.
jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    {
      META_BANNER: { get: () => mockFlags.META_BANNER, enumerable: true },
    },
  ),
);

const mockFtue = { enabled: false };
jest.mock('../ftueConfig', () =>
  Object.defineProperties(
    { ...jest.requireActual('../ftueConfig') },
    { FTUE_ENABLED: { get: () => mockFtue.enabled, enumerable: true } },
  ),
);

type BannerProps = {
  unitId: string;
  size: string;
  requestOptions: Record<string, unknown>;
  onAdLoaded: (d: { width: number; height: number }) => void;
  onAdFailedToLoad: (e: unknown) => void;
};

const mockBanner: {
  allowed: boolean;
  key: string;
  subscribers: Set<(v: boolean) => void>;
  lastProps: BannerProps | null;
  requests: number;
} = { allowed: false, key: 'unit|{}', subscribers: new Set(), lastProps: null, requests: 0 };

jest.mock('../ads', () => {
  const { View } = jest.requireActual('react-native');
  const R = jest.requireActual('react');
  function FakeBannerAd(props: BannerProps) {
    mockBanner.lastProps = props;
    return R.createElement(View, { testID: 'banner-ad' });
  }
  return {
    Ads: {
      get bannerAllowed() {
        return mockBanner.allowed;
      },
      subscribeBanner(cb: (v: boolean) => void) {
        mockBanner.subscribers.add(cb);
        return () => mockBanner.subscribers.delete(cb);
      },
      bannerRequest() {
        mockBanner.requests += 1;
        if (!mockBanner.allowed) return null;
        return {
          BannerAd: FakeBannerAd,
          size: 'ANCHORED_ADAPTIVE_BANNER',
          unitId: 'ca-app-pub-3940256099942544/9214589741',
          requestOptions: {},
          key: mockBanner.key,
        };
      },
    },
  };
});

function setAllowed(allowed: boolean): void {
  act(() => {
    mockBanner.allowed = allowed;
    for (const cb of [...mockBanner.subscribers]) cb(allowed);
  });
}

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

function statsBottom(menu: ReturnType<typeof render>): number {
  const style = [menu.getByText('3 puzzles solved').props.style].flat(Infinity) as Array<
    Record<string, unknown>
  >;
  const merged = Object.assign({}, ...style.filter(Boolean));
  return merged.bottom as number;
}

beforeEach(() => {
  store = new MapStore();
  store.setInt('arrows_total_solved', 3);
  previousStore = SaveSystem.useStore(store);
  mockFlags.META_BANNER = true;
  mockFtue.enabled = false;
  mockBanner.allowed = false;
  mockBanner.key = 'unit|{}';
  mockBanner.subscribers.clear();
  mockBanner.lastProps = null;
  mockBanner.requests = 0;
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
});

test('META_BANNER off: no banner and the ad module is never asked', () => {
  mockFlags.META_BANNER = false;
  mockBanner.allowed = true;
  const menu = render(<HomeScreen {...props} />);
  expect(menu.queryByTestId('menu-banner')).toBeNull();
  expect(mockBanner.requests).toBe(0);
  expect(mockBanner.subscribers.size).toBe(0);
  expect(statsBottom(menu)).toBe(32);
});

test('flag on but not allowed (killed, declined or SDK not ready): nothing rendered', () => {
  const menu = render(<HomeScreen {...props} />);
  expect(menu.queryByTestId('menu-banner')).toBeNull();
  expect(statsBottom(menu)).toBe(32);
});

test('allowed: the test banner mounts, reserves no space until loaded, then the stats line moves above it', () => {
  mockBanner.allowed = true;
  const menu = render(<HomeScreen {...props} />);
  expect(menu.getByTestId('menu-banner')).toBeTruthy();
  expect(mockBanner.lastProps!.unitId).toBe('ca-app-pub-3940256099942544/9214589741');
  expect(mockBanner.lastProps!.size).toBe('ANCHORED_ADAPTIVE_BANNER');
  expect(statsBottom(menu)).toBe(32); // nothing loaded: no space reserved

  act(() => mockBanner.lastProps!.onAdLoaded({ width: 411, height: 57.2 }));
  expect(statsBottom(menu)).toBe(58 + 32);

  act(() => mockBanner.lastProps!.onAdFailedToLoad(new Error('no fill')));
  expect(statsBottom(menu)).toBe(32);
});

test('a withdrawal or kill removes the banner at once and gives the space back', () => {
  mockBanner.allowed = true;
  const menu = render(<HomeScreen {...props} />);
  act(() => mockBanner.lastProps!.onAdLoaded({ width: 411, height: 50 }));
  expect(statsBottom(menu)).toBe(82);

  setAllowed(false);

  expect(menu.queryByTestId('menu-banner')).toBeNull();
  expect(statsBottom(menu)).toBe(32);
});

test('no banner while the player is still in the tutorial (Play would start T1)', () => {
  mockFtue.enabled = true;
  store.setInt('arrows_total_solved', 0);
  mockBanner.allowed = true;
  const menu = render(<HomeScreen {...props} />);
  expect(menu.queryByTestId('menu-banner')).toBeNull();
  expect(mockBanner.requests).toBe(0);
});
