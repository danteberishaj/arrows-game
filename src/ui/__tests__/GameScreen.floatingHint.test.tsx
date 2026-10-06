/**
 * W5-16 (ART_DEAD_BAND_ENABLED, dead-band option D): the game screen's hint button moves from the header's right
 * end to a floating button at the bottom left, the mirror twin of the removed POLISH-T4 "#" grid toggle
 * (b0fe740^: a 44 dp HeaderButton, 16 dp plus the safe-area inset from its corner). Relocation only: one Hint
 * button in either arm, with the same handler, ready/disabled state, a11y name, role and hit slop.
 * Placement, overlap with the board and tap-through close only on the emulator captures (artifacts/W5-16/).
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { BoardViewProps } from '../BoardView';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { Daylight, InkNight } from '../theme';

const mockArt = { ART_DEAD_BAND_ENABLED: false, ART_ICONS_ENABLED: false };
const mockReady = { hint: true };
const mockShowRewarded = jest.fn(async (_placement?: string) => false);

jest.mock('../BoardView', () => ({ BoardView: (_props: BoardViewProps) => null }));
jest.mock('../artConfig', () =>
  Object.defineProperties(
    { ...jest.requireActual('../artConfig') },
    {
      ART_DEAD_BAND_ENABLED: { get: () => mockArt.ART_DEAD_BAND_ENABLED, enumerable: true },
      ART_ICONS_ENABLED: { get: () => mockArt.ART_ICONS_ENABLED, enumerable: true },
    },
  ));
jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    {
      META_PANEL_MOTION: { get: () => false, enumerable: true },
      META_BANNER: { get: () => false, enumerable: true },
    },
  ));
jest.mock('../ftueConfig', () => ({ ...jest.requireActual('../ftueConfig'), FTUE_ENABLED: false }));
jest.mock('../ads', () => ({
  Ads: {
    get rewardedReady() {
      return mockReady.hint;
    },
    isRewardedReady: () => mockReady.hint,
    subscribeRewardedReady: () => () => undefined,
    registerGameFinished: () => undefined,
    showInterstitialIfDue: async () => undefined,
    showRewarded: (placement?: string) => mockShowRewarded(placement),
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { GameScreen } = require('../GameScreen') as typeof import('../GameScreen');
/* eslint-enable @typescript-eslint/no-require-imports */

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

const INSETS = { top: 24, bottom: 56, left: 7, right: 3 };
const METRICS = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: INSETS };

let previous: IntStore;
beforeEach(() => {
  mockArt.ART_DEAD_BAND_ENABLED = false;
  mockArt.ART_ICONS_ENABLED = false;
  mockReady.hint = true;
  mockShowRewarded.mockClear();
  const store = new MapStore();
  store.setInt('arrows_current_level', 7);
  store.setInt('arrows_total_solved', 20);
  store.setInt('arrows_ftue_stage', 3);
  previous = SaveSystem.useStore(store);
});
afterEach(() => {
  SaveSystem.useStore(previous);
});

const renderGame = (extra: { tutorialId?: 'T1' | 'T2'; palette?: typeof Daylight } = {}) =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <GameScreen
        palette={extra.palette ?? Daylight}
        onHome={jest.fn()}
        tutorialId={extra.tutorialId}
        feedbackEnabled={false}
      />
    </SafeAreaProvider>,
  );

const flat = (style: unknown) => (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
function ancestors(el: ReactTestInstance): ReactTestInstance[] {
  const out: ReactTestInstance[] = [];
  for (let n = el.parent; n; n = n.parent) out.push(n);
  return out;
}
/** The host View that is the header row (it holds "LEVEL N"). */
const isHeaderRow = (n: ReactTestInstance) =>
  typeof n.type === 'string' && flat(n.props.style).justifyContent === 'space-between' && flat(n.props.style).paddingHorizontal === 16;
/** The pressable's own style, resolved for the unpressed state. */
const buttonStyle = (el: ReactTestInstance) =>
  flat(typeof el.props.style === 'function' ? el.props.style({ pressed: false }) : el.props.style);

describe('W5-16 floating hint: flag OFF (today)', () => {
  test('the Hint button sits in the header row and nothing floats at the bottom left', () => {
    const screen = renderGame();
    const hints = screen.getAllByLabelText('Hint');
    expect(hints).toHaveLength(1);
    expect(ancestors(hints[0]).some(isHeaderRow)).toBe(true);
    expect(screen.queryByTestId('floating-hint')).toBeNull();
    expect(buttonStyle(hints[0]).width).toBe(36);
  });
});

describe('W5-16 floating hint: flag ON', () => {
  beforeEach(() => {
    mockArt.ART_DEAD_BAND_ENABLED = true;
  });

  test('exactly one Hint button, at the bottom left, absent from the header', () => {
    const screen = renderGame();
    const hints = screen.getAllByLabelText('Hint');
    expect(hints).toHaveLength(1);
    expect(ancestors(hints[0]).some(isHeaderRow)).toBe(false);
    const wrapper = screen.getByTestId('floating-hint');
    expect(ancestors(hints[0])).toContain(wrapper);
  });

  test('placement: the "#" toggle mirrored to the left edge, safe-area insets included, taps outside pass through', () => {
    const screen = renderGame();
    const wrapper = screen.getByTestId('floating-hint');
    const s = flat(wrapper.props.style);
    // The wrapper's padding is the button's hit slop, so the slop lies inside the wrapper (Android only hit-tests
    // inside a parent's bounds); the button's own edge sits at insets + 16 dp, as the "#" toggle's did.
    expect(wrapper.props.pointerEvents).toBe('box-none');
    expect(s.position).toBe('absolute');
    expect(s.padding).toBe(8);
    expect(s.left).toBe(INSETS.left + 16 - 8);
    expect(s.bottom).toBe(INSETS.bottom + 16 - 8);
    expect(s.right).toBeUndefined();
    expect(s.top).toBeUndefined();
  });

  test.each([[false, 44 / 3], [true, 22]])('the button is the "#" twin: 44 dp, 1 dp border, surface fill (ART_ICONS %s)', (icons, radius) => {
    mockArt.ART_ICONS_ENABLED = icons;
    for (const palette of [Daylight, InkNight]) {
      const screen = renderGame({ palette });
      const s = buttonStyle(screen.getByLabelText('Hint'));
      expect(s.width).toBe(44);
      expect(s.height).toBe(44);
      expect(s.borderRadius).toBeCloseTo(radius, 10);
      expect(s.borderWidth).toBe(1);
      expect(s.borderColor).toBe(palette.border);
      expect(s.backgroundColor).toBe(palette.surface);
      expect(s.elevation).toBeUndefined();
      expect(s.shadowOpacity).toBeUndefined();
      screen.unmount();
    }
  });

  test('a11y name, role and hit slop are unchanged', () => {
    const screen = renderGame();
    const hint = screen.getByLabelText('Hint');
    expect(hint.props.accessibilityRole).toBe('button');
    expect(hint.props.hitSlop).toBe(8);
  });

  test('the same handler fires: a press asks for the hint rewarded ad', async () => {
    const screen = renderGame();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Hint'));
    });
    expect(mockShowRewarded).toHaveBeenCalledTimes(1);
    expect(mockShowRewarded).toHaveBeenCalledWith('hint');
  });

  test.each([[true], [false]])('ready/disabled mirrors the header button (hint ad ready: %s)', (ready) => {
    mockReady.hint = ready;
    mockArt.ART_DEAD_BAND_ENABLED = false;
    const off = renderGame();
    const offHint = off.getByLabelText('Hint');
    const offState = offHint.props.accessibilityState;
    const offGlyph = buttonStyle(offHint);
    off.unmount();
    mockArt.ART_DEAD_BAND_ENABLED = true;
    const on = renderGame();
    const onHint = on.getByLabelText('Hint');
    expect(onHint.props.accessibilityState).toEqual(offState);
    expect(onHint.props.accessibilityState).toEqual({ disabled: !ready });
    expect(buttonStyle(onHint).backgroundColor).toBe(offGlyph.backgroundColor);
  });

  test('a disabled floating hint does not ask for an ad', async () => {
    mockReady.hint = false;
    const screen = renderGame();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Hint'));
    });
    expect(mockShowRewarded).not.toHaveBeenCalled();
  });

  test.each([['T1'], ['T2']] as const)('tutorial %s: no hint button anywhere, as in the header today', (tutorialId) => {
    const screen = renderGame({ tutorialId });
    expect(screen.queryByLabelText('Hint')).toBeNull();
    expect(screen.queryByTestId('floating-hint')).toBeNull();
  });
});
