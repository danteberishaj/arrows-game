import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { LevelGenerator } from '../../core';
import type { StaticBoardSurfaceProps } from '../StaticBoardSurface.types';
import { Daylight } from '../theme';

// HINT-SKIN (owner report 2026-11-19): after the rewarded hint, a skinned arrow glowed and a second later went
// invisible while it was still on the board. With a skin the native SkinMotion draws only a fading glow over the
// arrow, so the retained board must keep drawing the arrow itself (mask bit '1'). The flat look's Skia layer
// redraws the arrow in accent, so there the bit stays '0' (no double draw).
jest.mock('../../featureFlags', () => ({ ...jest.requireActual('../../featureFlags'), META_SKIN_PICKER: true, META_ZOOMED_CAMERA: true }));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
  useSharedValue: (initial: unknown) => {
    const ref = require('react').useRef(null);
    if (ref.current === null) ref.current = { value: initial };
    return ref.current;
  },
}));
let mockSpec: object | null = null;
jest.mock('../useArrowStyle', () => ({
  ...jest.requireActual('../useArrowStyle'),
  useArrowStyle: () => ({ id: mockSpec ? 'test-skin' : 'classic', spec: mockSpec }),
}));
const mockSurfaces: StaticBoardSurfaceProps[] = [];
jest.mock('../StaticBoardSurface', () => ({ StaticBoardSurface: (props: StaticBoardSurfaceProps) => { mockSurfaces.push(props); return null; } }));

function hintMaskBit(skinned: boolean): string {
  mockSpec = skinned ? {} : null;
  mockSurfaces.length = 0;
  const { BoardView } = require('../BoardView') as typeof import('../BoardView');
  const board = LevelGenerator.generate(3827, 1).board;
  const arrow = board.findHint()!;
  expect(arrow).toBeTruthy();
  const props = { board, palette: Daylight, onRemoved: jest.fn(), onBlocked: jest.fn(() => false), locked: false,
    hint: { arrow, id: 7 }, clearHint: jest.fn(), testID: 'hint-board' };
  const view = render(<BoardView {...props} />);
  act(() => fireEvent(view.getByTestId('hint-board'), 'layout', { nativeEvent: { layout: { width: 411.42857, height: 800 } } }));
  const surface = mockSurfaces[mockSurfaces.length - 1]!;
  view.unmount();
  // The hinted arrow is still on the board in both looks (the owner's question 2).
  expect(board.arrows()).toContain(arrow);
  const mask = surface.nativeVisibilityMask;
  expect(mask).toHaveLength(board.arrows().length);
  if (skinned) return mask[(surface.hint as { nativeIndex: number }).nativeIndex]!;
  // Flat look: the art carries no native index; the hint must be the only hidden arrow.
  expect(mask.split('0').length - 1).toBeLessThanOrEqual(1);
  return mask.includes('0') ? '0' : '1';
}

describe('hinted arrow in the native board mask', () => {
  const original = Platform.OS;
  beforeAll(() => Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' }));
  afterAll(() => Object.defineProperty(Platform, 'OS', { configurable: true, value: original }));

  it('stays drawn by the retained board under a skin (the glow only overlays it)', () => {
    expect(hintMaskBit(true)).toBe('1');
  });

  it('leaves the retained board on the flat look, where the Skia hint layer draws it', () => {
    expect(hintMaskBit(false)).toBe('0');
  });
});
