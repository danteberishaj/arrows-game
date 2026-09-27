import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { LevelGenerator } from '../../core';
import type { BoardViewProps } from '../BoardView';
import { centreOn, initialCamera } from '../boardCamera';
import type { StaticBoardSurfaceProps } from '../StaticBoardSurface.types';
import { Daylight } from '../theme';

// CAMERA-REFIT-AFTER-AD: a rewarded ad re-lays out the game screen. The board view measured 411 x 804.29 dp before
// the ad, 828.29 while it was up and 804.29 again after it closed (artifacts/W2-07/perf/invalid/A2-logcat.txt), and
// BoardView's onLayout re-fitted the camera on every layout, so a player who had panned or zoomed got the opening
// camera back after watching an ad. These tests drive BoardView's own onLayout with that sequence and read the camera
// the native surface is given (scale / tx / ty shared values). The device proof is the emulator capture
// (artifacts/CAMERA-REFIT-AFTER-AD/).

// `deferWrites` models how Reanimated applies a shared-value write made on the JS thread: it lands on the UI thread
// later, so a read in the same JS task still returns the old value (on the emulator the hint re-centre after a restore
// read the ad-time camera and threw the fit board off-centre: artifacts/CAMERA-REFIT-AFTER-AD/cap/fix-iter1). Writes
// are committed in order when the microtask queue runs (`flush()`).
const mockDefer = { on: false };
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
  // The stock mock returns a fresh object every render; keep one per hook call site (BoardView.handoff.test.tsx).
  useSharedValue: (init: unknown) => {
    const ref = require('react').useRef(null);
    if (ref.current === null) {
      let committed = init;
      ref.current = {
        get value() {
          return committed;
        },
        set value(v: unknown) {
          if (mockDefer.on) queueMicrotask(() => { committed = v; });
          else committed = v;
        },
      };
    }
    return ref.current;
  },
}));
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const mockSurfaces: StaticBoardSurfaceProps[] = [];
jest.mock('../StaticBoardSurface', () => ({
  StaticBoardSurface: (props: StaticBoardSurfaceProps) => {
    mockSurfaces.push(props);
    return null;
  },
}));

const CELL = 40;
const W = 411.4285583496094;
const H_BEFORE = 804.2857055664062; // the game screen before and after the ad
const H_DURING = 828.2857055664062; // while the ad is up

function mount(overrides: Partial<BoardViewProps> = {}) {
  const { BoardView } = require('../BoardView') as typeof import('../BoardView');
  const board = LevelGenerator.generate(0).board;
  const props: BoardViewProps = {
    board,
    palette: Daylight,
    onRemoved: jest.fn(),
    onBlocked: jest.fn(() => false),
    locked: false,
    hint: null,
    clearHint: jest.fn(),
    testID: 'board',
    ...overrides,
  };
  const view = render(<BoardView {...props} />);
  const layout = (width: number, height: number) =>
    act(() => {
      fireEvent(view.getByTestId('board'), 'layout', { nativeEvent: { layout: { width, height } } });
    });
  const cam = () => {
    const s = mockSurfaces[mockSurfaces.length - 1];
    return { scale: s.scale.value, tx: s.tx.value, ty: s.ty.value };
  };
  /** The player's pan / pinch: what the gesture worklets write to the same shared values. */
  const move = (pose: { scale: number; tx: number; ty: number }) => {
    const s = mockSurfaces[mockSurfaces.length - 1];
    s.scale.value = pose.scale;
    s.tx.value = pose.tx;
    s.ty.value = pose.ty;
  };
  const current = { ...props };
  const rerender = (next: Partial<BoardViewProps>) => {
    Object.assign(current, next);
    view.rerender(<BoardView {...current} />);
  };
  return { board, layout, cam, move, rerender };
}

const opening = (h: number, board = LevelGenerator.generate(0).board) => {
  const c = initialCamera(W, h, board.cols * CELL, board.rows * CELL, CELL, false)!;
  return { scale: c.scale, tx: c.tx, ty: c.ty };
};

beforeEach(() => {
  mockSurfaces.length = 0;
  mockDefer.on = false;
});

describe('the camera across a rewarded ad (the viewport round trip)', () => {
  it('opens at the opening camera', () => {
    const h = mount();
    h.layout(W, H_BEFORE);
    expect(h.cam()).toEqual(opening(H_BEFORE));
  });

  it('a panned / zoomed camera survives the ad: 804 -> 828 -> 804 gives the player\'s camera back', () => {
    const h = mount();
    h.layout(W, H_BEFORE);
    const o = opening(H_BEFORE);
    const player = { scale: o.scale * 2, tx: o.tx - 150, ty: o.ty - 90 };
    h.move(player);
    h.layout(W, H_DURING); // the ad is up (nobody sees this camera)
    h.layout(W, H_BEFORE); // the ad closed
    expect(h.cam()).toEqual(player);
  });

  it('a layout event of the same size keeps the camera', () => {
    const h = mount();
    h.layout(W, H_BEFORE);
    const o = opening(H_BEFORE);
    const player = { scale: o.scale * 1.5, tx: o.tx - 40, ty: o.ty - 30 };
    h.move(player);
    h.layout(W, H_BEFORE);
    expect(h.cam()).toEqual(player);
  });

  it('a real viewport change (one that does not come back) still re-fits', () => {
    const h = mount();
    h.layout(W, H_BEFORE);
    const o = opening(H_BEFORE);
    h.move({ scale: o.scale * 2, tx: o.tx - 150, ty: o.ty - 90 });
    h.layout(W, 600);
    expect(h.cam()).toEqual(opening(600));
  });

  it('a new board still re-fits, and forgets a camera held for the old board', () => {
    const h = mount();
    h.layout(W, H_BEFORE);
    const o = opening(H_BEFORE);
    h.move({ scale: o.scale * 2, tx: o.tx - 150, ty: o.ty - 90 });
    h.layout(W, H_DURING);
    const next = LevelGenerator.generate(1).board;
    act(() => h.rerender({ board: next }));
    expect(h.cam()).toEqual(opening(H_DURING, next));
    h.layout(W, H_BEFORE);
    expect(h.cam()).toEqual(opening(H_BEFORE, next)); // a re-fit, not the old board's camera
  });

  it('a hint granted while the ad was up is centred at the player\'s zoom after the camera comes back', () => {
    const h = mount();
    h.layout(W, H_BEFORE);
    const o = opening(H_BEFORE);
    const player = { scale: o.scale * 2.5, tx: o.tx - 200, ty: o.ty - 120 };
    h.move(player);
    h.layout(W, H_DURING);
    const arrow = h.board.findHint()!;
    act(() => h.rerender({ hint: { arrow, id: 7 } })); // the reward resolved before the layout came back
    h.layout(W, H_BEFORE);
    const cx = ((arrow.minCol + arrow.maxCol + 1) / 2) * CELL;
    const cy = ((arrow.minRow + arrow.maxRow + 1) / 2) * CELL;
    const want = centreOn(cx, cy, player.scale, W, H_BEFORE, h.board.cols * CELL, h.board.rows * CELL);
    expect(h.cam()).toEqual({ scale: player.scale, tx: want.tx, ty: want.ty });
  });

  it('with writes landing on the UI thread later (Reanimated), the hint is still centred from the RESTORED camera', async () => {
    mockDefer.on = true;
    const h = mount();
    h.layout(W, H_BEFORE);
    await flush();
    const o = opening(H_BEFORE);
    // The player's own camera: pinched out to the fit clamp (the device scenario), here at 1.5 x fit.
    const player = { scale: o.scale * 1.5, tx: o.tx - 60, ty: o.ty - 40 };
    h.move(player);
    await flush();
    h.layout(W, H_DURING); // the ad is up: a re-fit nobody sees
    await flush();
    const arrow = h.board.findHint()!;
    act(() => h.rerender({ hint: { arrow, id: 9 } })); // the reward resolved before the layout came back
    await flush();
    h.layout(W, H_BEFORE); // the ad closed: restore, then re-centre on the hint in the same JS task
    await flush();
    const cx = ((arrow.minCol + arrow.maxCol + 1) / 2) * CELL;
    const cy = ((arrow.minRow + arrow.maxRow + 1) / 2) * CELL;
    const want = centreOn(cx, cy, player.scale, W, H_BEFORE, h.board.cols * CELL, h.board.rows * CELL);
    expect(h.cam()).toEqual({ scale: player.scale, tx: want.tx, ty: want.ty });
  });
});
