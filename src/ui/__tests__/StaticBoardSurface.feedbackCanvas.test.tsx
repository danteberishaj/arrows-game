import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ArrowPath, BoardLogic, LevelGenerator } from '../../core';
import type { BoardViewProps } from '../BoardView';
import type { StaticBoardSurfaceProps } from '../StaticBoardSurface.types';
import { Daylight } from '../theme';

// POLISH-T7 (smoothness audit #2 and #6). The native feedback overlay is a
// full-viewport Skia canvas over the retained board.
// - #2: with no feedback up, the Skia tree under the canvas must be empty, so
//   no transform group subscribes to the camera shared values (Skia would
//   start a mapper that replays and presents an empty picture every pan frame).
//   The Canvas itself stays mounted (its TextureView is never recreated).
// - #6: the feedback art objects are memoised, so the memoised overlay
//   re-renders only when a feedback slot actually changes (an exit tap while a
//   hint is shown used to re-render it and restart its Skia mappers).
// Skia, the native board view and Reanimated are mocked: these are
// React-level checks; pixels close only on the emulator captures.

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

interface CanvasRender {
  /** Feedback slot ids of the StaticBoardSurface render this canvas render belongs to. */
  slots: string;
}
const mockCanvasRenders: CanvasRender[] = [];
let mockCanvasMounts = 0;
let mockCanvasUnmounts = 0;
let mockLastSurface: StaticBoardSurfaceProps | null = null;
let mockSurfaceRenders = 0;
const mockBoardMasks: string[] = [];

function mockSlotKey(s: StaticBoardSurfaceProps | null): string {
  if (s === null) return '?';
  return [s.pressed, s.blocker, s.shaking, s.hint]
    .map((art) => (art === null ? '-' : String(art.id)))
    .join('/');
}

jest.mock('@shopify/react-native-skia', () => {
  const mockReact = require('react');
  return {
    Canvas: (props: { children?: React.ReactNode }) => {
      mockCanvasRenders.push({ slots: mockSlotKey(mockLastSurface) });
      mockReact.useEffect(() => {
        mockCanvasMounts += 1;
        return () => { mockCanvasUnmounts += 1; };
      }, []);
      return mockReact.createElement('SkiaCanvas', null, props.children);
    },
    Group: (props: object) => mockReact.createElement('SkiaGroup', props),
    Path: (props: object) => mockReact.createElement('SkiaPath', props),
    rect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
    interpolateColors: () => '#000000',
  };
});

jest.mock('../../../modules/arrows-board', () => ({
  ArrowsBoardView: (props: { visibleMask: string }) => {
    mockBoardMasks.push(props.visibleMask);
    return null;
  },
}));

// Record what BoardView hands the real (memoised) native surface.
jest.mock('../StaticBoardSurface', () => {
  const mockReact = require('react');
  const actual = jest.requireActual('../StaticBoardSurface.native');
  return {
    StaticBoardSurface: (props: StaticBoardSurfaceProps) => {
      mockLastSurface = props;
      mockSurfaceRenders += 1;
      return mockReact.createElement(actual.StaticBoardSurface, props);
    },
  };
});

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

// Level 1 (index 0): arrow 14 is blocked, 21 is free (LevelGenerator is
// deterministic; artifacts/POLISH-T6/plan.json lists the same geometry).
const BLOCKED = 14;
const FREE = 21;

interface Harness {
  board: BoardLogic;
  arrows: ArrowPath[];
  view: ReturnType<typeof render>;
  rerender: (next: Partial<BoardViewProps>) => void;
  tap: (index: number) => void;
  advance: (ms: number) => void;
}

function mount(overrides: Partial<BoardViewProps> = {}): Harness {
  const { BoardView } = require('../BoardView') as typeof import('../BoardView');
  const board = LevelGenerator.generate(0).board;
  const arrows = [...board.arrows()];
  const current: BoardViewProps = {
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
  const view = render(<BoardView {...current} />);
  act(() => {
    fireEvent(view.getByTestId('board'), 'layout', {
      nativeEvent: { layout: { width: 411, height: 804 } },
    });
  });
  const tapGesture = () => mockGesture.toGestureArray()
    .find((g: any) => g.handlerName === 'TapGestureHandler');
  const advance = (ms: number) => {
    // One act per 16 ms "frame", so timers due in different frames commit
    // separately, as they do on a device.
    for (let t = 0; t < ms; t += 16) {
      act(() => {
        jest.advanceTimersByTime(Math.min(16, ms - t));
      });
    }
  };
  return {
    board,
    arrows,
    view,
    rerender: (next) => {
      Object.assign(current, next);
      view.rerender(<BoardView {...current} />);
    },
    tap: (index) => {
      const arrow = arrows[index];
      const mid = arrow.cells[Math.floor(arrow.cells.length / 2)];
      const s = mockLastSurface!;
      const e = {
        x: s.tx.value + (mid.c + 0.5) * 40 * s.scale.value,
        y: s.ty.value + (mid.r + 0.5) * 40 * s.scale.value,
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
    advance,
  };
}

/** Every host node rendered inside the Skia canvas. */
function skiaNodes(view: ReturnType<typeof render>) {
  const canvas = view.UNSAFE_root.find((n) => (n.type as unknown) === 'SkiaCanvas');
  return canvas.findAll((n) => typeof n.type === 'string' && n !== canvas);
}

/**
 * Groups whose transform is the camera (a derived value of tx, ty, scale):
 * the node that makes Skia subscribe to the camera shared values. The bump's
 * own translate-only transform is not one of them.
 */
function cameraGroups(view: ReturnType<typeof render>) {
  return skiaNodes(view).filter(
    (n) => (n.type as unknown) === 'SkiaGroup'
      && Array.isArray(n.props.transform?.value)
      && n.props.transform.value.some((t: object) => 'scale' in t),
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  mockCanvasRenders.length = 0;
  mockCanvasMounts = 0;
  mockCanvasUnmounts = 0;
  mockLastSurface = null;
  mockSurfaceRenders = 0;
  mockBoardMasks.length = 0;
  mockGesture = null;
  mockReducedMotion = false;
});
afterEach(() => {
  jest.useRealTimers();
});

describe('idle feedback canvas has an empty Skia tree (POLISH-T7, audit #2)', () => {
  test('all four slots null: no Skia node under the canvas; a hint mounts the transform group; clearing it empties the tree; the canvas is never remounted', () => {
    const h = mount();
    h.advance(100);
    expect(mockSlotKey(mockLastSurface)).toBe('-/-/-/-');
    expect(skiaNodes(h.view)).toHaveLength(0);
    expect(cameraGroups(h.view)).toHaveLength(0);

    h.rerender({ hint: { arrow: h.arrows[BLOCKED], id: 1 } });
    h.advance(100);
    expect(mockSlotKey(mockLastSurface)).toBe('-/-/-/1');
    const groups = cameraGroups(h.view);
    expect(groups).toHaveLength(1);
    // The camera transform is the board transform shared value (tx, ty, scale).
    expect(groups[0].props.transform.value).toEqual([
      { translateX: mockLastSurface!.tx.value },
      { translateY: mockLastSurface!.ty.value },
      { scale: mockLastSurface!.scale.value },
    ]);
    expect(skiaNodes(h.view).filter((n) => (n.type as unknown) === 'SkiaPath').length)
      .toBeGreaterThan(0);

    h.rerender({ hint: null });
    h.advance(100);
    expect(mockSlotKey(mockLastSurface)).toBe('-/-/-/-');
    expect(skiaNodes(h.view)).toHaveLength(0);
    expect({ mounts: mockCanvasMounts, unmounts: mockCanvasUnmounts })
      .toEqual({ mounts: 1, unmounts: 0 });
  });

  test.each([false, true])('a blocked tap (reduced motion %s) mounts the group with the bump and blocker, and the tree empties when both end', (reduced) => {
    mockReducedMotion = reduced;
    const h = mount();
    h.advance(100);
    h.tap(BLOCKED);
    expect(mockLastSurface!.shaking).not.toBeNull();
    expect(cameraGroups(h.view)).toHaveLength(1);
    h.advance(1500);
    expect(mockSlotKey(mockLastSurface)).toBe('-/-/-/-');
    expect(skiaNodes(h.view)).toHaveLength(0);
    expect(mockCanvasMounts).toBe(1);
    expect(mockCanvasUnmounts).toBe(0);
  });
});

describe('feedback art is memoised (POLISH-T7, audit #6)', () => {
  test('with a hint shown, an exit tap of another arrow re-renders the feedback canvas 0 times', () => {
    const h = mount();
    h.rerender({ hint: { arrow: h.arrows[BLOCKED], id: 1 } });
    h.advance(1000);
    const before = mockCanvasRenders.length;
    const surfacesBefore = mockSurfaceRenders;
    const masksBefore = mockBoardMasks.length;
    const countBefore = h.board.count();

    h.tap(FREE);
    h.advance(1000);

    // Positive controls: the exit happened and the surface re-rendered with it.
    expect(h.board.count()).toBe(countBefore - 1);
    expect(mockSurfaceRenders).toBeGreaterThan(surfacesBefore);
    expect(mockBoardMasks.length).toBeGreaterThan(masksBefore);
    expect(mockBoardMasks[mockBoardMasks.length - 1].charAt(FREE)).toBe('0');
    expect(mockSlotKey(mockLastSurface)).toBe('-/-/-/1');
    // The overlay did not.
    expect(mockCanvasRenders.length - before).toBe(0);
  });

  test('positive control: a new hint id does re-render the feedback canvas', () => {
    const h = mount();
    h.rerender({ hint: { arrow: h.arrows[BLOCKED], id: 1 } });
    h.advance(100);
    const before = mockCanvasRenders.length;
    h.rerender({ hint: { arrow: h.arrows[BLOCKED], id: 2 } });
    h.advance(100);
    expect(mockCanvasRenders.length - before).toBeGreaterThanOrEqual(1);
  });

  test.each([false, true])('rapid play (reduced motion %s): the canvas renders only when a feedback slot changes', (reduced) => {
    mockReducedMotion = reduced;
    const h = mount();
    h.rerender({ hint: { arrow: h.arrows[BLOCKED], id: 1 } });
    h.advance(100);
    const start = mockCanvasRenders.length;
    // Blocked tap (bump + blocker flash + a held missed mark handed back
    // mid-flash), an exit inside the flash, then everything settles.
    h.tap(BLOCKED);
    h.advance(48);
    h.tap(FREE);
    h.advance(1500);
    const renders = mockCanvasRenders.slice(start - 1);
    const redundant = renders
      .map((r, k) => (k > 0 && r.slots === renders[k - 1].slots ? `#${k} ${r.slots}` : null))
      .filter((r) => r !== null);
    expect(redundant).toEqual([]);
    // The sequence did exercise the overlay (bump mounted and ended).
    expect(renders.some((r) => r.slots.split('/')[2] !== '-')).toBe(true);
    expect(mockSlotKey(mockLastSurface).split('/')[2]).toBe('-');
  });
});
