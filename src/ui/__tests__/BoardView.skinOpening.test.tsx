import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { LevelGenerator } from '../../core';
import type { StaticBoardSurfaceProps } from '../StaticBoardSurface.types';
import { Daylight } from '../theme';

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
const mockSurfaces: StaticBoardSurfaceProps[] = [];
jest.mock('../StaticBoardSurface', () => ({ StaticBoardSurface: (props: StaticBoardSurfaceProps) => { mockSurfaces.push(props); return null; } }));

it('mounts the skin only after layout, with the real zoomed opening size on each level', () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  try {
    const { BoardView } = require('../BoardView') as typeof import('../BoardView');
    const props = { board: LevelGenerator.generate(3827, 1).board, palette: Daylight, onRemoved: jest.fn(),
      onBlocked: jest.fn(() => false), locked: false, hint: null, clearHint: jest.fn(), testID: 'skin-board' };
    const view = render(<BoardView {...props} />);
    expect(mockSurfaces).toHaveLength(0);
    act(() => fireEvent(view.getByTestId('skin-board'), 'layout', { nativeEvent: { layout: { width: 411.42857, height: 800 } } }));
    expect(mockSurfaces.length).toBeGreaterThan(0);
    for (const surface of mockSurfaces) expect(surface.initialCameraScale! * surface.cellSize).toBeCloseTo(411.42857 / 14);
    // A newly fitted smaller board must receive its own scale, not the previous level's tier.
    mockSurfaces.length = 0;
    view.rerender(<BoardView {...props} board={LevelGenerator.generate(0, 1).board} />);
    expect(mockSurfaces.length).toBeGreaterThan(0);
    for (const surface of mockSurfaces) expect(surface.initialCameraScale! * surface.cellSize).toBeGreaterThanOrEqual(28);
    view.unmount();
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  }
});
