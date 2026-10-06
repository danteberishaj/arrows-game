/**
 * HEADER-FIT: at 360 dp a long tier line ("Super Hard · Mushroom · 137 left", level 24, the widest v1 subline over
 * levels 1-3000: artifacts/HEADER-FIT/analysis/header-strings.ts) pushed the heart row and the hint button out of
 * the header, past the screen edge on level 120. The fix keeps the right block where it is and lets the text
 * column give way:
 * - the left block and the title column may shrink; the right block (hearts, hint) never does;
 * - the subline WRAPS (its row wraps the counter to a second line; the mission words wrap inside their own Text
 *   at large font scales). Nothing in it carries numberOfLines, so no ellipsis can hide the shape or the count;
 * - "LEVEL N" is the plain Text it was; only a title that wrapped (onTextLayout: two lines, e.g. 4-digit levels at
 *   font scale 1.3) turns into one line that shrinks to fit.
 * Jest cannot lay out text, so this pins the layout props that prevent the overflow; the emulator captures in
 * artifacts/HEADER-FIT/ close the pixel claims (positions, the one-line board top, the 1.3 font scale).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import type { BoardViewProps } from '../BoardView';
import { Daylight, InkNight, type Palette } from '../theme';

type Placement = 'continue' | 'hint';
const mockReady: Record<Placement, boolean> = { continue: true, hint: true };
const mockShowRewarded = jest.fn<Promise<boolean>, [Placement]>(async () => false);

jest.mock('../BoardView', () => ({
  BoardView: (_props: BoardViewProps) => null,
}));

jest.mock('../ads', () => ({
  Ads: {
    get rewardedReady() {
      return mockReady.continue;
    },
    isRewardedReady: (placement: Placement) => mockReady[placement],
    subscribeRewardedReady: () => () => undefined,
    registerGameFinished: jest.fn(),
    showInterstitialIfDue: jest.fn(async () => undefined),
    showRewarded: (placement: Placement) => mockShowRewarded(placement),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const GameScreenModule = require('../GameScreen') as typeof import('../GameScreen');
const { GameScreen } = GameScreenModule;

// The computed worst cases (artifacts/HEADER-FIT/analysis/header-strings-gap0.txt, HarfBuzz on the shipped Fredoka):
// the widest title of levels 1-9999 is "LEVEL 2222", 143.70 dp at font scale 1; the title column at 360 dp is
// 360 - 2 x 16 padding - (36 back + 12 gap) - (72 hearts + 12 gap + 36 hint) = 160 dp.
const WIDEST_TITLE_DP = 143.7;
const COLUMN_AT_360_DP = 160;

type Style = {
  flexDirection?: string;
  flex?: number;
  flexShrink?: number;
  flexGrow?: number;
  flexWrap?: string;
  minWidth?: number;
  minHeight?: number;
  width?: number;
  height?: number;
  fontSize?: number;
};
const flat = (node: ReactTestInstance) => (StyleSheet.flatten(node.props.style) ?? {}) as Style;

/** The nearest host (string-typed) ancestor: the View that lays `node` out. */
function hostParent(node: ReactTestInstance): ReactTestInstance {
  let p = node.parent;
  while (p && typeof p.type !== 'string') p = p.parent;
  if (!p) throw new Error('no host parent');
  return p;
}

/** The header row's direct child (host View) that contains `node`. */
function headerBlockOf(node: ReactTestInstance, header: ReactTestInstance): ReactTestInstance {
  let child = node;
  let p = hostParent(child);
  while (p !== header) {
    child = p;
    p = hostParent(child);
  }
  return child;
}

const renderGame = (index: number, palette: Palette = Daylight) =>
  render(<GameScreen palette={palette} onHome={jest.fn()} initialLevelIndex={index} feedbackEnabled={false} />);

function headerParts(screen: ReturnType<typeof renderGame>, title: string, mission: string) {
  const titleText = screen.getByText(title);
  const column = hostParent(titleText);
  const left = hostParent(column);
  const header = hostParent(left);
  const missionText = screen.getByText(mission);
  const sublineRow = hostParent(missionText);
  const hint = screen.getByLabelText('Hint');
  const right = headerBlockOf(hint, header);
  return { titleText, column, left, header, missionText, sublineRow, hint, right };
}

beforeEach(() => {
  mockReady.continue = true;
  mockReady.hint = true;
  mockShowRewarded.mockClear();
});

describe.each([['Daylight', Daylight], ['Ink Night', InkNight]] as const)('%s', (_name, palette) => {
  test('level 24 (the widest v1 subline): the text column shrinks, the right block does not', () => {
    const screen = renderGame(23, palette);
    const { column, left, right, header } = headerParts(screen, 'LEVEL 24', 'Super Hard · Mushroom · ');
    expect(flat(header).flexDirection ?? 'row').toBe('row');
    expect(flat(left).flexShrink).toBe(1);
    expect(flat(column).flexShrink).toBe(1);
    expect(flat(column).minWidth ?? 0).toBe(0);
    // The right block keeps its intrinsic width (hearts + hint), so its right edge is the header padding.
    expect(flat(right).flexShrink ?? 0).toBe(0);
    expect(flat(right).flex ?? 0).toBe(0);
  });

  test('the subline wraps instead of truncating: wrap row, shrinkable mission words, no numberOfLines', () => {
    const screen = renderGame(23, palette);
    const { missionText, sublineRow } = headerParts(screen, 'LEVEL 24', 'Super Hard · Mushroom · ');
    expect(flat(sublineRow).flexWrap).toBe('wrap');
    expect(flat(missionText).flexShrink).toBe(1);
    expect(missionText.props.numberOfLines).toBeUndefined();
    expect(missionText.props.adjustsFontSizeToFit).toBeFalsy();
    // The counter: one unit that moves to the next line whole, never ellipsized.
    const counter = screen.getByLabelText('137 left');
    expect(hostParent(counter)).toBe(sublineRow);
    for (const t of [screen.getByText('137'), screen.getByText(' left')]) {
      expect(t.props.numberOfLines).toBeUndefined();
      expect(t.props.adjustsFontSizeToFit).toBeFalsy();
    }
  });

  test('"LEVEL N" that fits stays the plain Text it was (no shrink props: Android shrank fitting titles)', () => {
    const screen = renderGame(23, palette);
    const { titleText } = headerParts(screen, 'LEVEL 24', 'Super Hard · Mushroom · ');
    expect(titleText.props.numberOfLines).toBeUndefined();
    expect(titleText.props.adjustsFontSizeToFit).toBeFalsy();
    expect(typeof titleText.props.onTextLayout).toBe('function');
    // A one-line layout changes nothing.
    act(() => {
      fireEvent(titleText, 'textLayout', { nativeEvent: { lines: [{ text: 'LEVEL 24' }] } });
    });
    expect(screen.getByText('LEVEL 24').props.adjustsFontSizeToFit).toBeFalsy();
  });

  test('a "LEVEL N" that wrapped becomes one line that shrinks to fit, never below 11 sp', () => {
    const screen = renderGame(23, palette);
    act(() => {
      fireEvent(screen.getByText('LEVEL 24'), 'textLayout', {
        nativeEvent: { lines: [{ text: 'LEVEL ' }, { text: '24' }] },
      });
    });
    const titleText = screen.getByText('LEVEL 24');
    expect(titleText.props.numberOfLines).toBe(1);
    expect(titleText.props.adjustsFontSizeToFit).toBe(true);
    const min = titleText.props.minimumFontScale as number;
    expect(min).toBe(GameScreenModule.HEADER_TITLE_MIN_FONT_SCALE);
    const size = flat(titleText).fontSize!;
    expect(size).toBe(24);
    expect(min * size).toBeGreaterThanOrEqual(11);
    // ...and low enough that the widest 4-digit title fits 360 dp at font scale 1.3 without an ellipsis.
    expect(min).toBeLessThanOrEqual(COLUMN_AT_360_DP / (WIDEST_TITLE_DP * 1.3));
  });

  test('the back button, hearts and hint keep their size: 36 dp + 8 dp slop = 52 dp touch target', () => {
    const screen = renderGame(23, palette);
    for (const label of ['Back', 'Hint']) {
      const button = screen.getByLabelText(label);
      expect(flat(button).width).toBe(36);
      expect(flat(button).height).toBe(36);
      expect(button.props.hitSlop).toBe(8);
      expect(flat(button).flexShrink ?? 0).toBe(0);
    }
  });
});

test('the daily header ("TODAY") uses the same fitting title', () => {
  const screen = render(
    <GameScreen palette={Daylight} onHome={jest.fn()} daily={{ day: 2470 }} feedbackEnabled={false} />,
  );
  const title = screen.getByText('TODAY');
  expect(flat(hostParent(title)).flexShrink).toBe(1);
  act(() => {
    fireEvent(title, 'textLayout', { nativeEvent: { lines: [{ text: 'TOD' }, { text: 'AY' }] } });
  });
  expect(screen.getByText('TODAY').props.numberOfLines).toBe(1);
  expect(screen.getByText('TODAY').props.adjustsFontSizeToFit).toBe(true);
});

test('"Hint unavailable ·" can wrap like the mission words it replaces', async () => {
  const screen = renderGame(23);
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Hint'));
    await Promise.resolve();
  });
  expect(mockShowRewarded).toHaveBeenCalledWith('hint');
  const label = screen.getByText('Hint unavailable · ');
  expect(flat(label).flexShrink).toBe(1);
  expect(label.props.numberOfLines).toBeUndefined();
  expect(flat(hostParent(label)).flexWrap).toBe('wrap');
});

test('while "Hint unavailable ·" shows, the row keeps the mission words\' height (no board re-fit)', async () => {
  const screen = renderGame(23);
  const row = hostParent(screen.getByText('Super Hard · Mushroom · '));
  expect(flat(row).minHeight).toBeUndefined();
  // Two subline lines at 360 dp: the mission words' row as Android laid it out.
  act(() => {
    fireEvent(row, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 160, height: 31 } } });
  });
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Hint'));
    await Promise.resolve();
  });
  const label = screen.getByText('Hint unavailable · ');
  const failedRow = hostParent(label);
  expect(flat(failedRow).minHeight).toBe(31);
  // A layout of the shorter stand-in line does not lower the floor.
  act(() => {
    fireEvent(failedRow, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 160, height: 16 } } });
  });
  expect(flat(hostParent(screen.getByText('Hint unavailable · '))).minHeight).toBe(31);
});

test('a short subline (level 1) has the same props: the fix is layout-only, not per level', () => {
  const screen = renderGame(0);
  const title = screen.getByText('LEVEL 1');
  expect(flat(hostParent(title)).flexShrink).toBe(1);
  expect(flat(hostParent(hostParent(title))).flexShrink).toBe(1);
});
