// src/ui/__tests__/RewardRevealCard.seasons.test.tsx — HALLOWEEN-01: "N of {visible total}", never a fixed 18.
import React from 'react';
import { render } from '@testing-library/react-native';
import { RewardRevealCard } from '../RewardRevealCard';
import { REWARD_PATH } from '../rewardCatalogue';
import { InkNight } from '../theme';

test('the collected line uses the unlock\'s visible total', () => {
  const unlock = { entry: REWARD_PATH[0], pathIndex: 0, ownedSkins: 5, totalSkins: 21, upNext: null };
  const { getByText } = render(<RewardRevealCard unlock={unlock} mode="campaign" levelNumber={3} points={3} palette={InkNight}
    dark reducedMotion disabled={false} onUse={() => {}} onKeep={() => {}} onShown={() => {}} />);
  getByText('5 of 21 styles collected');
});

describe('seasonsEnabled gate', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });
  function gate(env: Record<string, string>) {
    for (const key of Object.keys(process.env)) if (key.startsWith('EXPO_PUBLIC_META_')) delete process.env[key];
    Object.assign(process.env, env);
    let mod: typeof import('../rewardGate') | undefined;
    jest.isolateModules(() => {
      jest.doMock('../useArrowStyle', () => ({ skinPickerEnabled: () => process.env.EXPO_PUBLIC_META_SKIN_PICKER === '1' }));
      mod = require('../rewardGate');
    });
    return mod!.seasonsEnabled();
  }
  const all = { EXPO_PUBLIC_META_SKIN_PICKER: '1', EXPO_PUBLIC_META_REWARD_PATH: '1', EXPO_PUBLIC_META_REWARD_BOOK: '1', EXPO_PUBLIC_META_SEASONS: '1' };
  test('on only with picker, path, book and seasons all on', () => {
    expect(gate(all)).toBe(true);
    for (const key of Object.keys(all)) {
      const env: Record<string, string> = { ...all }; delete env[key];
      expect([key, gate(env)]).toEqual([key, false]);
    }
  });
});
