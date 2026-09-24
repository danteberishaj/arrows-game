import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ArrowPath, BoardLogic, LevelGenerator } from '../../core';
import type { BoardViewProps } from '../BoardView';
import type { StaticBoardSurfaceProps } from '../StaticBoardSurface.types';
import { Daylight } from '../theme';

// POLISH-T6: a blocked tap hands the tapped arrow from the native retained
// board to the Skia overlay and back. The two are separate render pipelines,
// so a commit that makes the overlay appear (or disappear) while the native
// board also changes that arrow can leave one frame where NEITHER draws it
// (emulator captures: artifacts/POLISH-T6/pre). The rule pinned here: the
// native board never changes a feedback arrow's paint in the same commit the
// overlay mounts or unmounts, and changes it only while the overlay has been
// covering it since an earlier commit. These are props-level checks; the
// frame-level proof is the emulator capture (Skia and native output cannot
// be observed in jest).

let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => mockReducedMotion,
  // The stock mock returns a fresh object every render, which would drop the
  // camera BoardView fits on layout; keep one per hook call site.
  useSharedValue: (init: unknown) => {
    const ref = require('react').useRef(null);
    if (ref.current === null) ref.current = { value: init };
    return ref.current;
  },
}));
jest.mock('../missedMarkFlag', () => ({ MISSED_MARK_ENABLED: true }));

const mockSurfaces: StaticBoardSurfaceProps[] = [];
jest.mock('../StaticBoardSurface', () => ({
  StaticBoardSurface: (props: StaticBoardSurfaceProps) => {
    mockSurfaces.push(props);
    return null;
  },
}));

let mockGesture: any = null;
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  return {
    ...actual,
    GestureDetector: ({ gesture, children }: { gesture: unknown; children: React.ReactNode }) => {
      mockGesture = gesture;
      return children;
    },
  };
});

// Level 1 (index 0): arrows 14 and 25 are blocked, 21 is free (LevelGenerator
// is deterministic; artifacts/POLISH-T6/plan.json lists the same geometry).
const X = 14;
const OTHER_BLOCKED = 25;
const FREE = 21;

interface Harness {
  board: BoardLogic;
  arrows: ArrowPath[];
  props: BoardViewProps;
  rerender: (next: Partial<BoardViewProps>) => void;
  tap: (index: number) => void;
  advance: (ms: number) => void;
}

function mount(overrides: Partial<BoardViewProps> = {}): Harness {
  const { BoardView } = require('../BoardView') as typeof import('../BoardView');
  const board = LevelGenerator.generate(0).board;
  const arrows = [...board.arrows()];
  const props: BoardViewProps = {
    board,
    palette: Daylight,
    onRemoved: jest.fn(),
    onBlocked: jest.fn((costsHeart: boolean) => costsHeart),
    locked: false,
    hint: null,
    clearHint: jest.fn(),
    testID: 'board',
    ...overrides,
  };
  const view = render(<BoardView {...props} />);
  act(() => {
    fireEvent(view.getByTestId('board'), 'layout', {
      nativeEvent: { layout: { width: 411, height: 804 } },
    });
  });
  const current = { ...props };
  const tapGesture = () => mockGesture.toGestureArray()
    .find((g: any) => g.handlerName === 'TapGestureHandler');
  return {
    board,
    arrows,
    props: current,
    rerender: (next) => {
      Object.assign(current, next);
      view.rerender(<BoardView {...current} />);
    },
    tap: (index) => {
      const arrow = arrows[index];
      const mid = arrow.cells[Math.floor(arrow.cells.length / 2)];
      const last = mockSurfaces[mockSurfaces.length - 1];
      const s = last.scale.value;
      const e = {
        x: last.tx.value + (mid.c + 0.5) * 40 * s,
        y: last.ty.value + (mid.r + 0.5) * 40 * s,
      };
      const g = tapGesture();
      act(() => {
        g.handlers.onBegin(e);
        g.handlers.onEnd(e, true);
        g.handlers.onFinalize(e, true);
        // The worklets mock delivers scheduleOnRN through queueMicrotask,
        // which the fake timers hold until flushed.
        jest.runAllTicks();
      });
    },
    // One act per 16 ms "frame", so timers due in different frames commit
    // separately, as they do on a device.
    advance: (ms) => {
      for (let t = 0; t < ms; t += 16) {
        act(() => {
          jest.advanceTimersByTime(Math.min(16, ms - t));
        });
      }
    },
  };
}

/** What each layer paints for arrow `i` in one committed surface. */
function paint(s: StaticBoardSurfaceProps, h: Harness, i: number) {
  const art = h.arrows[i];
  const shakingHere = s.shaking !== null && s.shaking.shaftD === (s.shaking && art
    ? require('../arrowGeometry').arrowArt(art, 40).shaftD
    : '');
  return {
    native: `${s.nativeVisibilityMask.charAt(i)}${s.nativeMarkMask.charAt(i) || '0'}`,
    overlay: shakingHere ? `s${s.shaking!.id}` : '',
  };
}

/** Distinct committed surfaces (React may render the mock twice per commit). */
function commits(): StaticBoardSurfaceProps[] {
  const out: StaticBoardSurfaceProps[] = [];
  for (const s of mockSurfaces) {
    const prev = out[out.length - 1];
    if (prev && prev.nativeVisibilityMask === s.nativeVisibilityMask
      && prev.nativeMarkMask === s.nativeMarkMask
      && (prev.shaking?.id ?? null) === (s.shaking?.id ?? null)
      && prev.shaking?.shaftD === s.shaking?.shaftD) continue;
    out.push(s);
  }
  return out;
}

/**
 * The hand-off rule for arrow `i` across every commit so far:
 * - native and overlay never both change in one commit (that commit races the
 *   two pipelines: a frame of neither, or of the old native look);
 * - the native paint changes only while the same overlay was already up in the
 *   previous commit and stays up in this one;
 * - the native board never stops drawing the arrow while it is on the board.
 */
function expectOverlappingHandoffs(h: Harness, i: number, { neverHiddenOnly = false } = {}) {
  const cs = commits();
  for (let k = 1; k < cs.length; k += 1) {
    const a = paint(cs[k - 1], h, i);
    const b = paint(cs[k], h, i);
    const nativeChanged = a.native !== b.native;
    const overlayChanged = a.overlay !== b.overlay;
    const where = `commit ${k}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`;
    if (!neverHiddenOnly) {
      expect({ where, both: nativeChanged && overlayChanged }).toEqual({ where, both: false });
    }
    if (!neverHiddenOnly && nativeChanged && h.board.arrows().includes(h.arrows[i])) {
      expect({ where, covered: a.overlay !== '' && a.overlay === b.overlay })
        .toEqual({ where, covered: true });
    }
    if (h.board.arrows().includes(h.arrows[i])) {
      expect({ where, drawn: b.native.charAt(0) }).toEqual({ where, drawn: '1' });
    }
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  mockSurfaces.length = 0;
  mockGesture = null;
  mockReducedMotion = false;
});
afterEach(() => {
  jest.useRealTimers();
});

describe('BoardView blocked-tap hand-off overlaps the two layers (POLISH-T6)', () => {
  test.each([false, true])('first charged tap (reduced motion %s): overlay mounts over a still-drawn arrow, the mark lands under it, then it unmounts', (reduced) => {
    mockReducedMotion = reduced;
    const h = mount();
    h.tap(X);
    const last = () => mockSurfaces[mockSurfaces.length - 1];
    expect(last().shaking).not.toBeNull();
    // The native board still draws X, in its pre-tap ink, in the mount commit.
    expect(paint(last(), h, X).native).toBe('10');
    // The overlay covers what the native board draws: the static-colour cover.
    expect(last().shaking!.cover).toBe(Daylight.bg);
    h.advance(400);
    expect(last().shaking).toBeNull();
    expect(paint(last(), h, X).native).toBe('11');
    expectOverlappingHandoffs(h, X);
  });

  test('re-tap of a marked arrow: the native mark never flickers off', () => {
    const h = mount();
    h.tap(X);
    h.advance(400);
    h.tap(X);
    expect(paint(mockSurfaces[mockSurfaces.length - 1], h, X).native).toBe('11');
    h.advance(400);
    expect(paint(mockSurfaces[mockSurfaces.length - 1], h, X).native).toBe('11');
    expectOverlappingHandoffs(h, X);
  });

  test('a re-tap of the same arrow before the hand-back keeps holding its new mark', () => {
    const h = mount();
    h.tap(X);
    h.advance(100);
    h.tap(X);
    expect(paint(mockSurfaces[mockSurfaces.length - 1], h, X).native).toBe('10');
    h.advance(1000);
    expect(paint(mockSurfaces[mockSurfaces.length - 1], h, X).native).toBe('11');
    expectOverlappingHandoffs(h, X);
  });

  test('a forgiven tap (no heart charged) settles to ink and never marks', () => {
    const h = mount({ onBlocked: jest.fn(() => false) });
    h.tap(X);
    h.advance(400);
    const last = mockSurfaces[mockSurfaces.length - 1];
    expect(last.shaking).toBeNull();
    expect(paint(last, h, X).native).toBe('10');
    expectOverlappingHandoffs(h, X);
  });

  test('a new blocked tap on another arrow supersedes the shake: nothing hidden or doubled for good', () => {
    const h = mount();
    h.tap(X);
    h.advance(100);
    h.tap(OTHER_BLOCKED);
    h.advance(100);
    h.tap(X); // re-tap mid-shake of the other arrow
    h.advance(1000);
    const last = mockSurfaces[mockSurfaces.length - 1];
    expect(last.shaking).toBeNull();
    expect(paint(last, h, X).native).toBe('11');
    expect(paint(last, h, OTHER_BLOCKED).native).toBe('11');
    expect(last.nativeVisibilityMask).toBe('1'.repeat(h.arrows.length));
    // Both were superseded before their mark's hand-back, so a held mark goes
    // to the board in the commit that drops its overlay (a possible frame of
    // the pre-tap ink, never a blank): only "never hidden" is pinned here.
    expectOverlappingHandoffs(h, X, { neverHiddenOnly: true });
    expectOverlappingHandoffs(h, OTHER_BLOCKED, { neverHiddenOnly: true });
  });

  test('the shaking arrow is removed (its blocker left): overlay goes, the native exit owns it', () => {
    const h = mount();
    h.tap(FREE);
    h.tap(X);
    h.advance(50);
    // Free X's lane for this test: remove every arrow that blocks it.
    let guard = 0;
    while (!h.board.canExit(h.arrows[X]) && guard < 60) {
      const blocker = h.board.blockerOf(h.arrows[X])!;
      act(() => { h.board.tryRemove(blocker); });
      guard += 1;
    }
    h.tap(X);
    h.advance(1000);
    const last = mockSurfaces[mockSurfaces.length - 1];
    expect(last.shaking).toBeNull();
    expect(last.nativeMarkMask.charAt(X) || '0').toBe('0');
    expect(last.nativeExitAnimation).not.toBeNull();
  });

  test('board reset (Retry / Next) mid-shake: no pending hand-back resurrects or hides an arrow', () => {
    const h = mount();
    h.tap(X);
    h.advance(50);
    h.rerender({ board: LevelGenerator.generate(0).board });
    h.advance(1000);
    const last = mockSurfaces[mockSurfaces.length - 1];
    expect(last.shaking).toBeNull();
    expect(last.nativeMarkMask).toBe('');
    expect(last.nativeVisibilityMask).toBe('1'.repeat(h.arrows.length));
  });
});
