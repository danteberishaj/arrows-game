// src/ui/__tests__/RewardRevealCard.test.tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { RewardRevealCard } from '../RewardRevealCard';
import { REWARD_PATH } from '../rewardCatalogue';
import { InkNight } from '../theme';

const unlock = { entry: REWARD_PATH[0], pathIndex: 0, ownedSkins: 4, upNext: { entry: REWARD_PATH[1], levels: 5 } };
function card(mode: 'campaign' | 'daily', extra: object = {}) {
  const onUse = jest.fn(), onKeep = jest.fn(), onShown = jest.fn();
  const r = render(<RewardRevealCard unlock={unlock} mode={mode} levelNumber={3} points={3} palette={InkNight}
    dark reducedMotion={false} disabled={false} onUse={onUse} onKeep={onKeep} onShown={onShown} {...extra} />);
  return { ...r, onUse, onKeep, onShown };
}

test('campaign card: informative copy and both buttons', () => {
  const { getByText, queryByText, getByTestId, onUse, onKeep, onShown } = card('campaign');
  getByText('NEW STYLE UNLOCKED'); getByText('Critter');
  getByText('4 of 18 styles collected');
  expect(queryByText('Little faces')).toBeNull(); // chips repeat the preview: removed (UX review)
  getByText('Up next: Cinnamon Roll · 5 levels');
  expect(onShown).toHaveBeenCalledTimes(1);
  fireEvent.press(getByTestId('reward-use')); expect(onUse).toHaveBeenCalledTimes(1);
  fireEvent.press(getByTestId('reward-keep')); expect(onKeep).toHaveBeenCalledTimes(1);
  getByText('Play with Critter'); getByText('Keep my current style');
});

test('daily card uses Use / Keep current style and the daily subtitle', () => {
  const { getByText } = card('daily');
  getByText('Use Critter'); getByText('Keep my current style');
  getByText('4 of 18 styles collected');
});

test('disabled while an ad is busy: presses do nothing', () => {
  const { getByTestId, onUse } = card('campaign', { disabled: true });
  fireEvent.press(getByTestId('reward-use'));
  expect(onUse).not.toHaveBeenCalled();
});

test('reduced motion renders no sparkles', () => {
  const { queryAllByTestId } = card('campaign', { reducedMotion: true });
  expect(queryAllByTestId('reward-sparkle')).toHaveLength(0);
});

test('announces the unlock to screen readers once, and the secondary target is at least 48 dp', () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  announce.mockClear(); // jest-expo already mocks this with a shared jest.fn: drop earlier tests' calls
  const { getByTestId } = card('campaign');
  expect(announce).toHaveBeenCalledTimes(1);
  expect(announce).toHaveBeenCalledWith('New style unlocked: Critter');
  const style = [getByTestId('reward-keep').props.style].flat();
  expect(Math.max(...style.map((s: { minHeight?: number }) => s?.minHeight ?? 0))).toBeGreaterThanOrEqual(48);
  announce.mockRestore();
});

test('no next free reward: omits the Up next line', () => {
  const { queryByText } = card('campaign', { unlock: { ...unlock, upNext: null } });
  expect(queryByText(/Up next:/)).toBeNull();
});
