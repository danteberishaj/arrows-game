/**
 * W5-05 (ART_PANEL_DEPTH_ENABLED) wiring in GameScreen. The token values and the composited edge are gated in
 * contrast.test.ts; what the rendered edge looks like (RN border rendering over a real scrim) closes only on the
 * emulator captures in artifacts/W5-05/. Here:
 * - flag OFF: the overlay scrim is today's literal ('rgba(0,0,0,0.45)' won, `bg` at 0.86 lost), the panel fill is
 *   `surface`, and the title / subline styles carry no new key;
 * - flag ON: the scrim is the palette's `scrimWon` / `scrimLost`, the fill is `surfaceRaised` (both overlay paths:
 *   the plain View and W2-05's PanelOverlayFrame), and the only other change is the spacing hierarchy (title
 *   marginBottom, subline marginBottom); normalising those five values gives back the flag-OFF tree exactly.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import type { BoardViewProps } from '../BoardView';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { Daylight, InkNight, type Palette } from '../theme';

let mockBoardViewProps: BoardViewProps | null = null;
const mockArt = { ART_PANEL_DEPTH_ENABLED: false };
const mockFlags = { META_PANEL_MOTION: false };
const mockFrameProps: Array<{ scrimColor: string; panelStyle: unknown }> = [];

jest.mock('../BoardView', () => ({
  BoardView: (props: BoardViewProps) => {
    mockBoardViewProps = props;
    return null;
  },
}));

jest.mock('../artConfig', () =>
  Object.defineProperties(
    { ...jest.requireActual('../artConfig') },
    { ART_PANEL_DEPTH_ENABLED: { get: () => mockArt.ART_PANEL_DEPTH_ENABLED, enumerable: true } },
  ));

jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    { META_PANEL_MOTION: { get: () => mockFlags.META_PANEL_MOTION, enumerable: true } },
  ));

// W2-05's frame: record the props GameScreen hands it (its own rendering is PanelPresence's tests' business).
jest.mock('../PanelPresence', () => {
  const actual = jest.requireActual('../PanelPresence');
  const { View: MockView } = jest.requireActual('react-native');
  return {
    ...actual,
    PanelOverlayFrame: (props: { scrimColor: string; panelStyle: unknown; children: React.ReactNode }) => {
      mockFrameProps.push({ scrimColor: props.scrimColor, panelStyle: props.panelStyle });
      return (
        <MockView testID="frame-scrim" style={{ backgroundColor: props.scrimColor }}>
          <MockView testID="frame-panel" style={props.panelStyle}>{props.children}</MockView>
        </MockView>
      );
    },
  };
});

jest.mock('../ads', () => ({
  Ads: {
    get rewardedReady() {
      return true;
    },
    isRewardedReady: () => true,
    subscribeRewardedReady: () => () => undefined,
    registerGameFinished: () => undefined,
    showInterstitialIfDue: async () => undefined,
    showRewarded: async () => false,
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GameScreen } = require('../GameScreen') as typeof import('../GameScreen');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { LOSE_PANEL_DELAY_MS, WON_PANEL_DELAY_MS } = require('../gameSessionLifecycle') as typeof import('../gameSessionLifecycle');

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

function renderGame(palette: Palette) {
  const store = new MapStore();
  SaveSystem.useStore(store);
  store.setInt('arrows_current_level', 7);
  store.setInt('arrows_total_solved', 20);
  store.setInt('arrows_ftue_stage', 3);
  store.setInt('arrows_perfect_streak', 3);
  return render(<GameScreen palette={palette} onHome={jest.fn()} feedbackEnabled={false} />);
}
type Screen = ReturnType<typeof renderGame>;

function win(screen: Screen) {
  const board = mockBoardViewProps!.board;
  act(() => {
    for (const arrow of [...board.arrows()]) board.tryRemove(arrow);
    mockBoardViewProps!.onRemoved(true, 0);
  });
  act(() => {
    jest.advanceTimersByTime(WON_PANEL_DELAY_MS);
  });
  expect(screen.getByText('Cleared!')).toBeTruthy();
}

function lose(screen: Screen) {
  for (let i = 0; i < 3; i += 1) {
    act(() => {
      mockBoardViewProps!.onBlocked(true);
    });
  }
  act(() => {
    jest.advanceTimersByTime(LOSE_PANEL_DELAY_MS);
  });
  expect(screen.getByText('Out of hearts')).toBeTruthy();
}

type Json = ReactTestRendererJSON;
const flat = (style: unknown): Record<string, unknown> =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : style && typeof style === 'object' ? { ...(style as object) } : {};
function walk(node: Json | string, visit: (n: Json) => void) {
  if (typeof node === 'string') return;
  visit(node);
  for (const c of node.children ?? []) walk(c, visit);
}
function find(tree: Json, pred: (n: Json) => boolean): Json[] {
  const out: Json[] = [];
  walk(tree, (n) => { if (pred(n)) out.push(n); });
  return out;
}
const textNode = (tree: Json, text: string) =>
  find(tree, (n) => n.type === 'Text' && (n.children ?? []).some((c) => typeof c === 'string' && c.includes(text)))[0];
/** The overlay scrim colour and the panel fill, whichever overlay path rendered. */
function overlay(tree: Json, title: string): { scrim: string; fill: string } {
  const panel = find(tree, (n) => (n.children ?? []).some((c) => typeof c !== 'string' && c === textNode(tree, title)))[0];
  const withBg = find(tree, (n) => n.type === 'View' && typeof flat(n.props.style).backgroundColor === 'string');
  // The innermost coloured ancestor of the panel (pre-order: the last match) is the scrim; the root's `bg` is outer.
  const scrimHost = withBg.filter((n) => n !== panel && find(n, (x) => x === panel).length > 0).at(-1);
  return { scrim: flat(scrimHost!.props.style).backgroundColor as string, fill: flat(panel.props.style).backgroundColor as string };
}

let previous: IntStore;
beforeEach(() => {
  jest.useFakeTimers();
  mockBoardViewProps = null;
  mockArt.ART_PANEL_DEPTH_ENABLED = false;
  mockFlags.META_PANEL_MOTION = false;
  mockFrameProps.length = 0;
  previous = SaveSystem.useStore(new MapStore());
});
afterEach(() => {
  SaveSystem.useStore(previous);
  jest.useRealTimers();
});

const CASES: Array<[string, Palette, 'won' | 'lost']> = [
  ['Daylight won', Daylight, 'won'], ['Daylight lost', Daylight, 'lost'], ['Ink Night won', InkNight, 'won'], ['Ink Night lost', InkNight, 'lost'],
];
const TITLE = { won: 'Cleared!', lost: 'Out of hearts' } as const;
const SUB = { won: 'Level 8 · ', lost: 'The shape got the better of you.' } as const;
const todayScrim = (p: Palette, outcome: 'won' | 'lost') => {
  if (outcome === 'won') return 'rgba(0,0,0,0.45)';
  const n = parseInt(p.bg.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.86)`;
};

describe.each([false, true])('META_PANEL_MOTION %s', (motion) => {
  beforeEach(() => {
    mockFlags.META_PANEL_MOTION = motion;
  });

  describe('flag OFF (default): today\'s panel', () => {
    it.each(CASES)('%s: literal scrim, `surface` fill, no new style key', (_n, palette, outcome) => {
      const screen = renderGame(palette);
      if (outcome === 'won') win(screen); else lose(screen);
      const tree = screen.toJSON() as Json;
      expect(overlay(tree, TITLE[outcome])).toEqual({ scrim: todayScrim(palette, outcome), fill: palette.surface });
      expect(flat(textNode(tree, TITLE[outcome]).props.style).marginBottom).toBeUndefined();
      expect(flat(textNode(tree, SUB[outcome]).props.style).marginBottom).toBe(20);
      if (motion) expect(mockFrameProps.at(-1)!.scrimColor).toBe(todayScrim(palette, outcome));
    });
  });

  describe('flag ON', () => {
    beforeEach(() => {
      mockArt.ART_PANEL_DEPTH_ENABLED = true;
    });

    it.each(CASES)('%s: the scrim token, `surfaceRaised`, and the spacing hierarchy', (_n, palette, outcome) => {
      const screen = renderGame(palette);
      if (outcome === 'won') win(screen); else lose(screen);
      const tree = screen.toJSON() as Json;
      expect(overlay(tree, TITLE[outcome])).toEqual({
        scrim: outcome === 'won' ? palette.scrimWon : palette.scrimLost,
        fill: palette.surfaceRaised,
      });
      expect(flat(textNode(tree, TITLE[outcome]).props.style).marginBottom).toBe(4);
      expect(flat(textNode(tree, SUB[outcome]).props.style).marginBottom).toBe(28);
      if (motion) expect(mockFrameProps.at(-1)!.scrimColor).toBe(outcome === 'won' ? palette.scrimWon : palette.scrimLost);
    });

    it.each(CASES)('%s: normalising the five depth values gives back the flag-OFF tree', (_n, palette, outcome) => {
      mockArt.ART_PANEL_DEPTH_ENABLED = false;
      const off = renderGame(palette);
      if (outcome === 'won') win(off); else lose(off);
      const offTree = JSON.stringify(off.toJSON());
      off.unmount();
      mockArt.ART_PANEL_DEPTH_ENABLED = true;
      const on = renderGame(palette);
      if (outcome === 'won') win(on); else lose(on);
      const tree = on.toJSON() as Json;
      walk(tree, (n) => {
        const fix = (st: Record<string, unknown>) => {
          if (st.backgroundColor === palette.scrimWon && outcome === 'won') st.backgroundColor = todayScrim(palette, outcome);
          if (st.backgroundColor === palette.scrimLost && outcome === 'lost') st.backgroundColor = todayScrim(palette, outcome);
          if (st.backgroundColor === palette.surfaceRaised && st.borderColor === palette.border) st.backgroundColor = palette.surface;
        };
        const styles = Array.isArray(n.props.style) ? n.props.style : [n.props.style];
        for (const st of styles) if (st && typeof st === 'object') fix(st as Record<string, unknown>);
      });
      const title = textNode(tree, TITLE[outcome]);
      const sub = textNode(tree, SUB[outcome]);
      for (const node of [title, sub]) {
        const last = (node.props.style as Array<Record<string, unknown>>).at(-1)!;
        if (node === title) { expect(last.marginBottom).toBe(4); delete last.marginBottom; }
        else { expect(last.marginBottom).toBe(28); delete last.marginBottom; }
      }
      expect(JSON.stringify(tree)).toBe(offTree);
    });
  });
});
