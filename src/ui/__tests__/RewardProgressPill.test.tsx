// src/ui/__tests__/RewardProgressPill.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { RewardProgressPill } from '../RewardProgressPill';
import { REWARD_PATH } from '../rewardCatalogue';
import { InkNight } from '../theme';

const base = { owned: { lo: 0, hi: 0 }, pickerSeenIndex: 0 };

test('shows the next style, points earned and levels to go (singular)', () => {
  const { getByText } = render(<RewardProgressPill palette={InkNight} earned={2}
    state={{ ...base, points: 2, reachedIndex: 0, next: REWARD_PATH[0], levelsToNext: 1, progress: 2 / 3 }} />);
  getByText('Next style: Critter');
  getByText('1 more level'); // one line: no wrap (UX review)
  getByText('+2');
});

test('plural levels and singular point', () => {
  const { getByText } = render(<RewardProgressPill palette={InkNight} earned={1}
    state={{ ...base, points: 4, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 4, progress: .2 }} />);
  getByText('4 more levels');
  getByText('+1');
});

test('complete path shows the collected line', () => {
  const { getByText, queryByText } = render(<RewardProgressPill palette={InkNight} earned={1}
    state={{ ...base, points: 200, reachedIndex: 15, next: null, levelsToNext: null, progress: 1 }} />);
  getByText('All styles collected · new ones coming soon');
  expect(queryByText(/Next style/)).toBeNull();
});
