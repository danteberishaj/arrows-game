/**
 * W4-11 (META_REVIEW_PROMPT) wiring in GameScreen, against the real SaveSystem
 * over an in-memory store with persistence healthy. The policy itself is
 * pinned in src/core/__tests__/reviewPolicy.test.ts; here:
 * - flag OFF: expo-store-review is never loaded and nothing is written;
 * - flag ON: the ask fires once, REVIEW_DWELL_MS after the won panel commits
 *   (never during its entrance), only on a real perfect campaign or daily
 *   clear, never before an interstitial, in benchmark mode, after the player
 *   left the panel or while the app is in the background; the bookkeeping is
 *   written before the OS call whatever it does; Next / Done wait for an
 *   in-flight flow (bounded) so the card can never land over the next board.
 * What the OS shows closes only on a device (UNVERIFIED-DEVICE in the report).
 */
import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import type { BoardViewProps } from '../BoardView';
import { Daylight } from '../theme';

let mockBoardViewProps: BoardViewProps | null = null;
const mockFlags = { META_REVIEW_PROMPT: false, META_LEVEL_TRANSITION: false };
const mockScrimCalls: string[] = [];
const mockAdsState = { interstitialDue: false };
const mockShowInterstitialIfDue = jest.fn(async () => undefined);
let mockStoreReviewLoads = 0;
/** `available` backs isAvailableAsync, `request` backs the review request. */
const mockStoreReview = {
  available: jest.fn(async (): Promise<boolean> => true),
  request: jest.fn(async (): Promise<void> => undefined),
};

jest.mock('expo-store-review', () => {
  mockStoreReviewLoads += 1;
  return {
    isAvailableAsync: () => mockStoreReview.available(),
    requestReview: () => mockStoreReview.request(),
  };
});

jest.mock('../BoardView', () => ({
  BoardView: (props: BoardViewProps) => {
    mockBoardViewProps = props;
    return null;
  },
}));

jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    {
      META_REVIEW_PROMPT: { get: () => mockFlags.META_REVIEW_PROMPT, enumerable: true },
      META_LEVEL_TRANSITION: { get: () => mockFlags.META_LEVEL_TRANSITION, enumerable: true },
    },
  ));

// W2-04's real sequencer with a driver that never finishes on its own: the
// cover settles by its JS backstop (180 + 85 ms), like a slow device.
jest.mock('../ScreenScrim', () => {
  const { View: MockView } = jest.requireActual('react-native');
  const { ScrimTransition } = jest.requireActual('../scrimTransition');
  return {
    ScreenScrim: () => <MockView testID="level-scrim" />,
    createLevelScrimTransition: () => new ScrimTransition({
      coverMs: 180,
      uncoverMs: 180,
      backstopMarginMs: 85,
      now: () => Date.now(),
      setTimer: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimer: (h: ReturnType<typeof setTimeout>) => clearTimeout(h),
      requestFrame: (fn: () => void) => setTimeout(fn, 16),
      cancelFrame: (h: ReturnType<typeof setTimeout>) => clearTimeout(h),
      subscribeAppState: () => () => undefined,
      driver: {
        cover: (ms: number) => mockScrimCalls.push(`cover ${ms}`),
        uncover: (ms: number) => mockScrimCalls.push(`uncover ${ms}`),
        snap: (v: number) => mockScrimCalls.push(`snap ${v}`),
      },
    }),
    showAdThenPanelBeat: (show: () => Promise<unknown>) => show().then(() => undefined),
  };
});

jest.mock('../ads', () => ({
  Ads: {
    get rewardedReady() {
      return false;
    },
    get interstitialDue() {
      return mockAdsState.interstitialDue;
    },
    isRewardedReady: () => false,
    subscribeRewardedReady: () => () => undefined,
    registerGameFinished: jest.fn(),
    showInterstitialIfDue: () => mockShowInterstitialIfDue(),
    showRewarded: async () => false,
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GameScreen } = require('../GameScreen') as typeof import('../GameScreen');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { WON_PANEL_DELAY_MS } = require('../gameSessionLifecycle') as typeof import('../gameSessionLifecycle');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { REVIEW_DWELL_MS, REVIEW_FLOW_WAIT_MAX_MS, reviewSession } = require('../reviewPrompt') as typeof import('../reviewPrompt');

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

const LEVEL = 7;
const DAY = 2450; // SaveSystem.today() under the injected clock below

let store: MapStore;
let previousStore: IntStore;
let previousClock: () => Date;
let previousHealthy: boolean;
let appStateListeners: ((state: string) => void)[];
let diagLines: string[];

type GameProps = Partial<React.ComponentProps<typeof GameScreen>>;
const renderGame = (props: GameProps = {}) =>
  render(<GameScreen palette={Daylight} onHome={jest.fn()} feedbackEnabled={false} {...props} />);

async function flush() {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

/** Every arrow out, then the delayed won commit: the panel has just mounted. */
function clearBoard() {
  const board = mockBoardViewProps!.board;
  act(() => {
    for (const arrow of [...board.arrows()]) board.tryRemove(arrow);
    mockBoardViewProps!.onRemoved(true, 0);
  });
  act(() => {
    jest.advanceTimersByTime(WON_PANEL_DELAY_MS);
  });
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await flush();
  });
}

async function pressNext(screen: ReturnType<typeof renderGame>) {
  await act(async () => {
    fireEvent.press(screen.getByText('Next level'));
    await flush();
  });
}

const reviewKeys = () => [store.map.get('arrows_review_count'), store.map.get('arrows_review_last_day')];

beforeEach(() => {
  jest.useFakeTimers();
  mockBoardViewProps = null;
  mockFlags.META_REVIEW_PROMPT = false;
  mockFlags.META_LEVEL_TRANSITION = false;
  mockScrimCalls.length = 0;
  mockAdsState.interstitialDue = false;
  mockShowInterstitialIfDue.mockClear();
  mockStoreReview.available.mockReset().mockImplementation(async () => true);
  mockStoreReview.request.mockReset().mockImplementation(async () => undefined);
  reviewSession.asked = false;
  store = new MapStore();
  previousStore = SaveSystem.useStore(store);
  previousClock = SaveSystem.useClock(() => new Date(2020, 0, 1 + DAY, 12, 0, 0));
  previousHealthy = SaveSystem.persistenceHealthy;
  SaveSystem.setPersistenceHealthy(true);
  store.setInt('arrows_current_level', LEVEL);
  store.setInt('arrows_total_solved', 30);
  store.setInt('arrows_ftue_stage', 3);
  appStateListeners = [];
  diagLines = [];
  // jest-expo runs with __DEV__ on, so reviewDiag's `[review]` lines land here.
  jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    diagLines.push(args.map(String).join(' '));
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, listener: (state: string) => void) => {
    appStateListeners.push(listener);
    return { remove: () => { appStateListeners = appStateListeners.filter((l) => l !== listener); } };
  }) as unknown as typeof AppState.addEventListener);
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  SaveSystem.useClock(previousClock);
  SaveSystem.setPersistenceHealthy(previousHealthy);
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('flag OFF (default)', () => {
  // First in the file on purpose: the module-load counter starts at 0.
  test('an eligible perfect clear never loads expo-store-review, never calls it and writes no review key', async () => {
    const screen = renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS * 5);

    expect(mockStoreReviewLoads).toBe(0);
    expect(mockStoreReview.available).not.toHaveBeenCalled();
    expect(mockStoreReview.request).not.toHaveBeenCalled();
    expect(reviewKeys()).toEqual([undefined, undefined]);
    expect(reviewSession.asked).toBe(false);
    // BASE behaviour: the panel is up and Next loads the next level at once.
    await pressNext(screen);
    expect(screen.getByText(`LEVEL ${LEVEL + 2}`)).toBeTruthy();
  });

  test('the won panel subscribes to nothing new (no AppState listener, no timer left behind)', async () => {
    renderGame();
    clearBoard();
    expect(appStateListeners).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
    expect(diagLines.filter((l) => l.startsWith('[review]'))).toEqual([]);
  });
});

describe('flag ON', () => {
  beforeEach(() => {
    mockFlags.META_REVIEW_PROMPT = true;
  });

  test('fires once, REVIEW_DWELL_MS after the won commit; the keys are written before the OS call', async () => {
    let countAtCall: number | null = null;
    mockStoreReview.request.mockImplementation(async () => {
      countAtCall = SaveSystem.reviewCount;
    });
    const screen = renderGame();
    clearBoard();
    expect(screen.getByText('Next level')).toBeTruthy(); // the panel has committed

    await advance(REVIEW_DWELL_MS - 1); // entrance, stars: nothing asked yet
    expect(mockStoreReview.available).not.toHaveBeenCalled();
    expect(reviewKeys()).toEqual([undefined, undefined]);

    await advance(1);
    expect(mockStoreReview.available).toHaveBeenCalledTimes(1);
    expect(mockStoreReview.request).toHaveBeenCalledTimes(1);
    expect(countAtCall).toBe(1);
    expect(reviewKeys()).toEqual([1, DAY]);
    expect(reviewSession.asked).toBe(true);
  });

  test('a second perfect clear in the same session makes no second call', async () => {
    const screen = renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS);
    expect(mockStoreReview.request).toHaveBeenCalledTimes(1);

    await pressNext(screen);
    expect(screen.getByText(`LEVEL ${LEVEL + 2}`)).toBeTruthy();
    clearBoard();
    await advance(REVIEW_DWELL_MS * 3);
    expect(mockStoreReview.available).toHaveBeenCalledTimes(1);
    expect(mockStoreReview.request).toHaveBeenCalledTimes(1);
    expect(reviewKeys()).toEqual([1, DAY]);
    // The dev log says why: one full ask, then a check declined for the session.
    expect(diagLines.filter((l) => l.startsWith('[review] check'))).toEqual([
      expect.stringContaining('decline=none'),
      expect.stringContaining('decline=asked_this_session'),
    ]);
    expect(diagLines.filter((l) => l.startsWith('[review] request count='))).toEqual(['[review] request count=1 lastDay=2450']);
  });

  test('a new GameScreen (menu and back) in the same process is the same session', async () => {
    const first = renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS);
    first.unmount();

    store.setInt('arrows_review_count', 0); // even with the quota bookkeeping reset
    store.setInt('arrows_review_last_day', 0);
    renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS * 3);
    expect(mockStoreReview.request).toHaveBeenCalledTimes(1);
  });

  test('the OS rejecting the request still counts it, and the panel stays usable', async () => {
    mockStoreReview.request.mockImplementation(async () => {
      throw new Error('ERR_STORE_REVIEW_FAILED');
    });
    const screen = renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS);
    expect(reviewKeys()).toEqual([1, DAY]);
    await pressNext(screen);
    expect(screen.getByText(`LEVEL ${LEVEL + 2}`)).toBeTruthy();
  });

  test('isAvailableAsync false: no request and no bookkeeping (no quota was spent), not retried this session', async () => {
    mockStoreReview.available.mockImplementation(async () => false);
    const screen = renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS);
    expect(mockStoreReview.request).not.toHaveBeenCalled();
    expect(reviewKeys()).toEqual([undefined, undefined]);

    await pressNext(screen);
    clearBoard();
    await advance(REVIEW_DWELL_MS);
    expect(mockStoreReview.available).toHaveBeenCalledTimes(1);
  });

  test('isAvailableAsync throwing (e.g. the native module missing) is caught: no crash, no request, no bookkeeping', async () => {
    mockStoreReview.available.mockImplementation(async () => {
      throw new Error("Cannot find native module 'ExpoStoreReview'");
    });
    const screen = renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS);
    expect(mockStoreReview.request).not.toHaveBeenCalled();
    expect(reviewKeys()).toEqual([undefined, undefined]);
    await pressNext(screen);
    expect(screen.getByText(`LEVEL ${LEVEL + 2}`)).toBeTruthy();
  });

  test('a non-perfect clear (a heart lost) never asks', async () => {
    renderGame();
    act(() => {
      mockBoardViewProps!.onBlocked(true);
    });
    clearBoard();
    await advance(REVIEW_DWELL_MS * 3);
    expect(mockStoreReview.available).not.toHaveBeenCalled();
    expect(reviewKeys()).toEqual([undefined, undefined]);
  });

  test('ruling F12: the assisted stage-2 -> 3 clear passes assisted = true (the stage is read before W1-06 writes 3)', async () => {
    store.setInt('arrows_ftue_stage', 2);
    renderGame();
    clearBoard();
    expect(SaveSystem.ftueStage).toBe(3); // W1-06 ended the assist on this perfect clear
    await advance(REVIEW_DWELL_MS * 3);
    expect(mockStoreReview.available).not.toHaveBeenCalled();
    expect(reviewKeys()).toEqual([undefined, undefined]);
  });

  test('below the solve minimum never asks (totalSolved 23 + this clear = 24)', async () => {
    store.setInt('arrows_total_solved', 23);
    renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS * 3);
    expect(mockStoreReview.available).not.toHaveBeenCalled();
  });

  test('89 days after the last ask never asks; 90 days does', async () => {
    store.setInt('arrows_review_count', 1);
    store.setInt('arrows_review_last_day', DAY - 89);
    const screen = renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS * 3);
    expect(mockStoreReview.available).not.toHaveBeenCalled();
    screen.unmount();

    store.setInt('arrows_review_last_day', DAY - 90);
    renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS);
    expect(mockStoreReview.request).toHaveBeenCalledTimes(1);
    expect(reviewKeys()).toEqual([2, DAY]);
  });

  test('a daily perfect clear asks (a daily never shows an interstitial)', async () => {
    mockAdsState.interstitialDue = true; // campaign pacing is irrelevant to a daily
    renderGame({ daily: { day: DAY } });
    clearBoard();
    await advance(REVIEW_DWELL_MS);
    expect(mockStoreReview.request).toHaveBeenCalledTimes(1);
    expect(reviewKeys()).toEqual([1, DAY]);
  });

  test('never before an ad: a campaign clear whose Next would show an interstitial does not ask', async () => {
    mockAdsState.interstitialDue = true;
    renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS * 3);
    expect(mockStoreReview.available).not.toHaveBeenCalled();
    expect(reviewKeys()).toEqual([undefined, undefined]);
    expect(reviewSession.asked).toBe(false);
  });

  test('never in benchmark mode', async () => {
    renderGame({ benchmarkMode: true });
    clearBoard();
    await advance(REVIEW_DWELL_MS * 3);
    expect(mockStoreReview.available).not.toHaveBeenCalled();
  });

  test('never on a tutorial clear', async () => {
    store.setInt('arrows_ftue_stage', 1);
    renderGame({ tutorialId: 'T2' });
    clearBoard();
    await advance(REVIEW_DWELL_MS * 3);
    expect(mockStoreReview.available).not.toHaveBeenCalled();
  });

  test('never when persistence is unhealthy (the lifetime count cannot be honoured)', async () => {
    SaveSystem.setPersistenceHealthy(false);
    renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS * 3);
    expect(mockStoreReview.available).not.toHaveBeenCalled();
  });

  test('Next pressed before the dwell ends: no ask, then or later (the interstitial path included)', async () => {
    const screen = renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS - 500);
    await pressNext(screen);
    await advance(REVIEW_DWELL_MS * 3);
    expect(mockShowInterstitialIfDue).toHaveBeenCalledTimes(1);
    expect(mockStoreReview.available).not.toHaveBeenCalled();
    expect(reviewSession.asked).toBe(false);
  });

  test('Next under W2-04\'s scrim, pressed just before the dwell ends: no ask while the scrim covers the level swap', async () => {
    mockFlags.META_LEVEL_TRANSITION = true;
    const screen = renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS - 100);
    await pressNext(screen);
    expect(mockScrimCalls).toContain('cover 180');
    expect(screen.getByText(`LEVEL ${LEVEL + 1}`)).toBeTruthy(); // still covering: the phase is still 'won'
    await advance(200); // past the dwell, before the cover's backstop (265 ms)
    expect(mockStoreReview.available).not.toHaveBeenCalled();
    await advance(REVIEW_DWELL_MS * 3);
    expect(screen.getByText(`LEVEL ${LEVEL + 2}`)).toBeTruthy();
    expect(mockStoreReview.available).not.toHaveBeenCalled();
  });

  test('Next with an interstitial still on screen when the dwell ends: no ask over the ad', async () => {
    let closeAd!: () => void;
    mockShowInterstitialIfDue.mockImplementationOnce(() => new Promise<undefined>((resolve) => { closeAd = () => resolve(undefined); }));
    const screen = renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS - 100);
    await pressNext(screen);
    await advance(REVIEW_DWELL_MS * 3); // the ad is still up
    expect(mockStoreReview.available).not.toHaveBeenCalled();
    await act(async () => {
      closeAd();
      await flush();
    });
    expect(screen.getByText(`LEVEL ${LEVEL + 2}`)).toBeTruthy();
    expect(mockStoreReview.available).not.toHaveBeenCalled();
  });

  test('Done (daily) pressed before the dwell ends: no ask', async () => {
    const onHome = jest.fn();
    const screen = renderGame({ daily: { day: DAY }, onHome });
    clearBoard();
    await advance(REVIEW_DWELL_MS - 500);
    await act(async () => {
      fireEvent.press(screen.getByText('Done'));
      await flush();
    });
    expect(onHome).toHaveBeenCalledTimes(1);
    await advance(REVIEW_DWELL_MS * 3);
    expect(mockStoreReview.available).not.toHaveBeenCalled();
  });

  test('the app going to the background during the dwell cancels the ask (it would land on resume)', async () => {
    renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS - 500);
    expect(appStateListeners.length).toBeGreaterThan(0);
    act(() => {
      for (const listener of [...appStateListeners]) listener('background');
    });
    await advance(REVIEW_DWELL_MS * 3);
    expect(mockStoreReview.available).not.toHaveBeenCalled();
  });

  test('unmounting during the dwell cancels the ask', async () => {
    const screen = renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS - 500);
    screen.unmount();
    await advance(REVIEW_DWELL_MS * 3);
    expect(mockStoreReview.available).not.toHaveBeenCalled();
  });

  test('Next during an in-flight flow waits for it to settle before advancing (no card over the next board)', async () => {
    let settle!: () => void;
    mockStoreReview.request.mockImplementation(() => new Promise<void>((resolve) => { settle = resolve; }));
    const screen = renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS);
    expect(mockStoreReview.request).toHaveBeenCalledTimes(1);

    await pressNext(screen);
    await pressNext(screen); // a second press while waiting is ignored
    expect(screen.getByText(`LEVEL ${LEVEL + 1}`)).toBeTruthy();
    expect(mockShowInterstitialIfDue).not.toHaveBeenCalled();

    await act(async () => {
      settle();
      await flush();
    });
    expect(mockShowInterstitialIfDue).toHaveBeenCalledTimes(1);
    expect(screen.getByText(`LEVEL ${LEVEL + 2}`)).toBeTruthy();
  });

  test('a flow that never settles holds Next for at most REVIEW_FLOW_WAIT_MAX_MS', async () => {
    mockStoreReview.request.mockImplementation(() => new Promise<void>(() => undefined));
    const screen = renderGame();
    clearBoard();
    await advance(REVIEW_DWELL_MS);
    await pressNext(screen);
    await advance(REVIEW_FLOW_WAIT_MAX_MS - 1);
    expect(screen.getByText(`LEVEL ${LEVEL + 1}`)).toBeTruthy();
    await advance(1);
    expect(screen.getByText(`LEVEL ${LEVEL + 2}`)).toBeTruthy();
  });
});
