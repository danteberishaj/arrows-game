/**
 * POLISH-T9 #2 (META_PRESS_SPRING): the shared press wrapper.
 * - Flag OFF: every wrapped button's style function returns today's output byte for
 *   byte (JSON of the base code's `({ pressed }) => …` for pressed and released).
 * - Flag ON: a full press (pressIn -> pressOut -> press) fires onPress exactly once,
 *   the style no longer snaps a scale, and the scale is driven by the brief's
 *   timing (press-in) and spring (release), both following the system reduce-motion.
 * Motion and pixels are NOT verified here (jest cannot): the 4x-slowed emulator
 * recordings in artifacts/POLISH-T9/ close that.
 */
import React from 'react';
import { act, render, userEvent } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import * as Reanimated from 'react-native-reanimated';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import type { BoardViewProps } from '../BoardView';
import { GameScreen } from '../GameScreen';
import { HeaderButton } from '../HeaderButton';
import { HomeScreen } from '../HomeScreen';
import { Daylight } from '../theme';

const mockFlags = { META_PRESS_SPRING: false };
jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    { META_PRESS_SPRING: { get: () => mockFlags.META_PRESS_SPRING, enumerable: true } },
  ),
);

let mockBoardViewProps: BoardViewProps;
jest.mock('../BoardView', () => ({
  BoardView: (props: BoardViewProps) => {
    mockBoardViewProps = props;
    return null;
  },
}));

jest.mock('../ads', () => ({
  Ads: {
    get rewardedReady() {
      return true;
    },
    isRewardedReady: () => true,
    subscribeRewardedReady: () => () => undefined,
    registerGameFinished: jest.fn(),
    showInterstitialIfDue: jest.fn(),
    showRewarded: jest.fn(async () => false),
    subscribeBanner: () => () => undefined,
    bannerRequest: () => null,
  },
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

const p = Daylight;
type StyleFn = (state: { pressed: boolean; hovered?: boolean }) => unknown;

/** The composite Pressable that owns `node` (the text inside a button): the nearest
 * ancestor whose `style` is a function and that takes `onPress`. */
function pressableOf(node: ReactTestInstance): ReactTestInstance {
  let current: ReactTestInstance | null = node;
  while (current && !(typeof current.props.style === 'function' && 'onPress' in current.props)) {
    current = current.parent;
  }
  if (!current) throw new Error('no Pressable ancestor');
  return current;
}

function styleOutput(node: ReactTestInstance, pressed: boolean): string {
  return JSON.stringify((pressableOf(node).props.style as StyleFn)({ pressed, hovered: false }));
}

const homeProps = {
  palette: p,
  dark: false,
  soundOn: true,
  onPlay: jest.fn(),
  onToggleSound: jest.fn(),
  onToggleTheme: jest.fn(),
};

function renderGame() {
  return render(
    <GameScreen palette={p} onHome={jest.fn()} initialLevelIndex={0} benchmarkMode feedbackEnabled={false} />,
  );
}

function renderWonPanel() {
  const screen = renderGame();
  act(() => {
    mockBoardViewProps.onRemoved(true);
    jest.runOnlyPendingTimers();
  });
  return screen;
}

function renderLostPanel() {
  const screen = renderGame();
  act(() => {
    for (let i = 0; i < 8; i += 1) mockBoardViewProps.onBlocked(true);
    jest.runOnlyPendingTimers();
  });
  return screen;
}

// Today's (1bf0f7e) style-function outputs, key order included.
const headerButtonToday = (pressed: boolean, size = 36) => JSON.stringify({
  width: size,
  height: size,
  borderRadius: size / 3,
  borderWidth: 1,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: pressed ? p.heartLost : p.surface,
  borderColor: p.border,
  transform: [{ scale: pressed ? 0.94 : 1 }],
});
const buttonStyle = { borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12 };

let previousStore: IntStore;
beforeEach(() => {
  const store = new MapStore();
  store.setInt('arrows_total_solved', 3);
  previousStore = SaveSystem.useStore(store);
  mockFlags.META_PRESS_SPRING = false;
  jest.useFakeTimers();
});
afterEach(() => {
  SaveSystem.useStore(previousStore);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('META_PRESS_SPRING off: style functions are byte-identical to today', () => {
  test('HeaderButton (36 and 44 dp)', () => {
    const small = render(<HeaderButton label="‹" palette={p} onPress={jest.fn()} />);
    expect(styleOutput(small.getByText('‹'), false)).toBe(headerButtonToday(false));
    expect(styleOutput(small.getByText('‹'), true)).toBe(headerButtonToday(true));
    const big = render(<HeaderButton label="#" palette={p} onPress={jest.fn()} size={44} />);
    expect(styleOutput(big.getByText('#'), false)).toBe(headerButtonToday(false, 44));
    expect(styleOutput(big.getByText('#'), true)).toBe(headerButtonToday(true, 44));
  });

  test('Home Play pill', () => {
    const menu = render(<HomeScreen {...homeProps} />);
    const play = { width: 250, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' };
    for (const pressed of [false, true]) {
      expect(styleOutput(menu.getByText('Play'), pressed)).toBe(JSON.stringify([
        play,
        { backgroundColor: pressed ? p.accentDeep : p.accent, transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]));
    }
  });

  test('panel Next level (won)', () => {
    const screen = renderWonPanel();
    for (const pressed of [false, true]) {
      expect(styleOutput(screen.getByText('Next level'), pressed)).toBe(JSON.stringify([
        buttonStyle,
        { transform: [{ scale: pressed ? 0.94 : 1 }] },
        false,
        { backgroundColor: pressed ? p.accentDeep : p.accent },
      ]));
    }
  });

  test('panel Continue and Retry (lost)', () => {
    const screen = renderLostPanel();
    for (const pressed of [false, true]) {
      expect(styleOutput(screen.getByText('Continue +♥ (ad)'), pressed)).toBe(JSON.stringify([
        buttonStyle,
        {
          backgroundColor: pressed ? p.accentDeep : p.accent,
          marginBottom: 12,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]));
      expect(styleOutput(screen.getByText('Retry'), pressed)).toBe(JSON.stringify([
        buttonStyle,
        { transform: [{ scale: pressed ? 0.94 : 1 }] },
        { backgroundColor: 'transparent', borderWidth: 1, borderColor: p.border },
        false,
      ]));
    }
  });
});

describe('META_PRESS_SPRING on', () => {
  beforeEach(() => {
    mockFlags.META_PRESS_SPRING = true;
  });

  test('a full press fires HeaderButton onPress exactly once; hitSlop and a11y are kept', async () => {
    const onPress = jest.fn();
    const screen = render(
      <HeaderButton
        label="#"
        palette={p}
        onPress={onPress}
        size={44}
        accessibilityRole="switch"
        accessibilityLabel="Grid lines"
        checked={false}
      />,
    );
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.press(screen.getByLabelText('Grid lines'));
    expect(onPress).toHaveBeenCalledTimes(1);
    const pressable = pressableOf(screen.getByText('#'));
    expect(pressable.props.hitSlop).toBe(8);
    expect(pressable.props.accessibilityRole).toBe('switch');
    expect(pressable.props.accessibilityState).toEqual({ checked: false, disabled: false });
  });

  test('a full press fires the Play pill and Next level exactly once each', async () => {
    const onPlay = jest.fn();
    const menu = render(<HomeScreen {...homeProps} onPlay={onPlay} />);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.press(menu.getByText('Play'));
    expect(onPlay).toHaveBeenCalledTimes(1);
    menu.unmount();

    const screen = renderWonPanel();
    const before = SaveSystem.currentLevel;
    const firstBoard = mockBoardViewProps.board;
    await user.press(screen.getByText('Next level'));
    // Benchmark mode keeps SaveSystem untouched; one press loads exactly one new board.
    expect(SaveSystem.currentLevel).toBe(before);
    expect(mockBoardViewProps.board).not.toBe(firstBoard);
    expect(screen.queryByText('Next level')).toBeNull();
  });

  test('the style function no longer snaps a scale; colour stays a pressed style', () => {
    const screen = render(<HeaderButton label="‹" palette={p} onPress={jest.fn()} />);
    const pressed = JSON.parse(styleOutput(screen.getByText('‹'), true));
    expect(pressed.transform).toBeUndefined();
    expect(pressed.backgroundColor).toBe(p.heartLost);
  });

  test('press-in eases to 0.94 over 90 ms, release springs back to 1 (reduce motion: system)', () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const spring = jest.spyOn(Reanimated, 'withSpring');
    const screen = render(<HeaderButton label="‹" palette={p} onPress={jest.fn()} />);
    const pressable = pressableOf(screen.getByText('‹'));
    act(() => pressable.props.onPressIn({}));
    expect(timing).toHaveBeenCalledWith(0.94, expect.objectContaining({
      duration: 90,
      reduceMotion: Reanimated.ReduceMotion.System,
    }));
    act(() => pressable.props.onPressOut({}));
    expect(spring).toHaveBeenCalledWith(1, expect.objectContaining({
      damping: 15,
      stiffness: 400,
      mass: 1, // Reanimated 4 defaults mass to 4: twice as bouncy, ~5 s of frames per release
      reduceMotion: Reanimated.ReduceMotion.System,
    }));
  });
});
