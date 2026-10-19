/**
 * TF-02 C: the accessibility sweep over the skin picker, the collection book (grid, confirm, bought) and the
 * reward reveal card (all behind META_SKIN_PICKER / META_REWARD_PATH / META_REWARD_BOOK). Every reachable pressable
 * has a role and a spoken label (a toggle, its state). Mocks follow ArrowStyleOptions.rewards.test.tsx.
 */
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { Daylight, InkNight } from '../theme';
import { a11yGaps, pressableCount } from './a11yAudit';

const mockState = { current: null as unknown };
const mockOwned = new Set([0, 2, 4, 6]);
jest.mock('../useRewards', () => ({ useRewards: () => mockState.current }));
jest.mock('../haptics', () => ({ Haptic: { cleared: jest.fn() } }));
jest.mock('../rewardLedger', () => ({
  ...jest.requireActual('../rewardLedger'),
  isRewardOwned: (id: number) => mockOwned.has(id),
  isRewardNew: () => false,
  etaFor: (id: number) => (id === 1 ? 4 : id === 5 ? 10 : null),
  markPickerSeen: () => undefined,
  buyReward: () => 'bought',
}));
jest.mock('../arrowStyleSelection', () => ({ ...jest.requireActual('../arrowStyleSelection'), chooseArrowStyle: () => undefined }));
jest.mock('../useArrowStyle', () => ({ useArrowStyle: () => ({ id: 'sherbet' }), skinPickerEnabled: () => true }));
jest.mock('../ads', () => ({
  Ads: {
    isRewardedReady: () => true,
    subscribeRewardedReady: () => () => undefined,
    showRewarded: async () => false,
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { ArrowStyleOptions } = require('../ArrowStyleOptions') as typeof import('../ArrowStyleOptions');
const { RewardRevealCard } = require('../RewardRevealCard') as typeof import('../RewardRevealCard');
const { REWARD_PATH } = require('../rewardCatalogue') as typeof import('../rewardCatalogue');
/* eslint-enable @typescript-eslint/no-require-imports */

const base = { points: 4, owned: { lo: 0, hi: 0 }, reachedIndex: 1, levelsToNext: 4, progress: .2, newMask: { lo: 0, hi: 0 } };
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe.each([['Daylight', Daylight], ['Ink Night', InkNight]] as const)('%s', (_name, palette) => {
  it('picker on the reward path (no book): style radios, locked rows, Back', () => {
    mockState.current = { ...base, next: REWARD_PATH[1], petals: null, canBuy: false };
    const r = render(<ArrowStyleOptions palette={palette} onBack={jest.fn()} />);
    expect(a11yGaps(r.root)).toEqual([]);
    expect(pressableCount(r.root)).toBeGreaterThanOrEqual(5);
  });

  it('picker with the book: tabs, next-free line, then the book grid, confirm and bought screens', () => {
    mockState.current = { ...base, next: REWARD_PATH[1], petals: 18, canBuy: true, petalAds: true };
    const r = render(<ArrowStyleOptions palette={palette} onBack={jest.fn()} />);
    expect(r.getByRole('tab', { name: 'Your styles, 4' })).toBeTruthy();
    expect(a11yGaps(r.root)).toEqual([]);
    fireEvent.press(r.getByTestId('tab-book'));
    expect(r.getByTestId('book-grid')).toBeTruthy();
    expect(a11yGaps(r.root)).toEqual([]);
    fireEvent.press(r.getByTestId(`book-tile-${REWARD_PATH[1].refId}`));
    expect(r.getByRole('button', { name: `Buy for ${REWARD_PATH[1].price} petals` })).toBeTruthy();
    expect(a11yGaps(r.root)).toEqual([]);
    fireEvent.press(r.getByTestId('book-buy'));
    expect(r.getByRole('button', { name: 'Use it now' })).toBeTruthy();
    expect(r.getByRole('button', { name: 'Back to the book' })).toBeTruthy();
    expect(a11yGaps(r.root)).toEqual([]);
  });

  it.each(['campaign', 'daily'] as const)('reward reveal card (%s)', (mode) => {
    const unlock = { entry: REWARD_PATH[0], pathIndex: 0, ownedSkins: 4, totalSkins: 18, upNext: { entry: REWARD_PATH[1], levels: 5 } };
    const r = render(<RewardRevealCard unlock={unlock} mode={mode} levelNumber={3} points={3} palette={palette}
      dark={palette === InkNight} reducedMotion disabled={false} onUse={jest.fn()} onKeep={jest.fn()} onShown={jest.fn()} />);
    expect(a11yGaps(r.root)).toEqual([]);
    expect(pressableCount(r.root)).toBe(2);
    expect(r.getByRole('button', { name: 'Keep my current style' })).toBeTruthy();
  });
});
