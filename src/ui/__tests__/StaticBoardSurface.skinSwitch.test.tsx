import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { initializeArrowStyle, chooseArrowStyle } from '../arrowStyleSelection';
import { SKIN_SPEC_JSON, ARROW_STYLES } from '../skinSpecs';
import type { StaticBoardSurfaceProps } from '../StaticBoardSurface.types';

let mockPicker = true;
let mockMounts = 0;
let mockUnmounts = 0;
let mockProps: Record<string, unknown> = {};
jest.mock('../../featureFlags', () => Object.defineProperty({ ...jest.requireActual('../../featureFlags'), ART_SKIN: 'cinnamon' }, 'META_SKIN_PICKER', { get: () => mockPicker }));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  return { Canvas: (p: object) => React.createElement('Canvas', p), Group: () => null, Path: () => null, rect: jest.fn(), interpolateColors: jest.fn() };
});
jest.mock('../../../modules/arrows-board', () => ({ ArrowsBoardView: (props: Record<string, unknown>) => {
  mockProps = props;
  require('react').useEffect(() => { mockMounts++; return () => { mockUnmounts++; }; }, []);
  return null;
} }));
const props: StaticBoardSurfaceProps = {
  scale: { value: .734693854 } as any, tx: { value: 0 } as any, ty: { value: 0 } as any,
  boardW: 1560, boardH: 1560, viewportW: 411, viewportH: 800,
  shaftD: '', headD: '', nativeGeometry: 'original-flat', skinGeometry: 'owned-cells', nativeVisibilityMask: '1',
  background: '#FFFFFF', ink: '#222222', accent: '#222222', heart: '#A32355', cellSize: 40,
  initialCameraScale: .734693854, strokeWidth: 5, shaking: null, blocker: null, pressed: null, hint: null,
  nativeExitAnimation: null, reducedMotion: true, grid: null, nativeMarkMask: '', markShaftD: '', markHeadD: '', markColor: '#222222', exiting: [],
};
const initialOS = Platform.OS;
beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  mockPicker = true; mockMounts = 0; mockUnmounts = 0;
  initializeArrowStyle({ getInt: (_, fallback) => fallback, setInt: jest.fn(), deleteKey: jest.fn() }, true);
});
afterEach(() => { Object.defineProperty(Platform, 'OS', { value: initialOS, configurable: true }); });
it('Classic→Cinnamon→Sherbet→Classic updates one JSON prop on the same native board with current real cell size', () => {
  const { StaticBoardSurface } = require('../StaticBoardSurface.native');
  const view = render(<StaticBoardSurface {...props} />);
  expect(mockProps.artSkin).toBe('');
  for (const id of ['cinnamon', 'sherbet', 'classic']) {
    act(() => chooseArrowStyle(id));
    expect(mockProps.artSkin).toBe(id === 'classic' ? '' : SKIN_SPEC_JSON[id]);
    expect(mockProps.geometry).toBe('original-flat');
    const config = String(mockProps.skinConfig).split(',');
    expect(config.slice(0,3)).toEqual(['40','1','0']);
    expect(Number(config[3])).toBeCloseTo(29.38775416);
    expect(config[4]).toBe('#A32355');
    expect(mockMounts).toBe(1); expect(mockUnmounts).toBe(0);
  }
  view.unmount(); expect(mockUnmounts).toBe(1);
});
it.each(['android', 'ios'])('flag OFF never sends procedural props on %s, even with the old ART_SKIN env selection', os => {
  mockPicker = false;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  act(() => chooseArrowStyle('cinnamon'));
  const { StaticBoardSurface } = require('../StaticBoardSurface.native');
  render(<StaticBoardSurface {...props} />);
  expect(mockProps).not.toHaveProperty('artSkin'); expect(mockProps).not.toHaveProperty('skinGeometry');
});
it('stable numeric identities and registry order are explicit', () => {
  expect(ARROW_STYLES.slice(0,3).map(s => [s.id,s.numericId])).toEqual([['classic',0],['cinnamon',1],['sherbet',2]]);
  expect(new Set(ARROW_STYLES.map(s => s.numericId)).size).toBe(ARROW_STYLES.length);
});
