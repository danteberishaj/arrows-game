// src/ui/__tests__/RewardRevealCard.test.tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RewardRevealCard } from '../RewardRevealCard';
import { REWARD_PATH } from '../rewardCatalogue';
import { InkNight } from '../theme';

const unlock = { entry: REWARD_PATH[0], pathIndex: 0, ownedSkins: 4 };
function card(mode: 'campaign' | 'daily', extra: object = {}) {
  const onUse = jest.fn(), onKeep = jest.fn(), onShown = jest.fn();
  const r = render(<RewardRevealCard unlock={unlock} mode={mode} levelNumber={3} points={3} palette={InkNight}
    dark reducedMotion={false} disabled={false} onUse={onUse} onKeep={onKeep} onShown={onShown} {...extra} />);
  return { ...r, onUse, onKeep, onShown };
}

test('campaign card: informative copy and both buttons', () => {
  const { getByText, getByTestId, onUse, onKeep, onShown } = card('campaign');
  getByText('NEW STYLE UNLOCKED'); getByText('Critter');
  getByText('Style 4 of 18 · unlocked on level 3');
  getByText('Little faces'); getByText('Up next: Cinnamon Roll · 5 levels');
  expect(onShown).toHaveBeenCalledTimes(1);
  fireEvent.press(getByTestId('reward-use')); expect(onUse).toHaveBeenCalledTimes(1);
  fireEvent.press(getByTestId('reward-keep')); expect(onKeep).toHaveBeenCalledTimes(1);
  getByText('Play with Critter'); getByText('Keep current style · Next level');
});

test('daily card uses Use / Keep current style and the daily subtitle', () => {
  const { getByText } = card('daily');
  getByText('Use Critter'); getByText('Keep current style');
  getByText("Style 4 of 18 · unlocked on today's daily");
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
