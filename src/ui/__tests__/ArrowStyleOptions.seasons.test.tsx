// src/ui/__tests__/ArrowStyleOptions.seasons.test.tsx — HALLOWEEN-01: seasonal styles in the picker.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Daylight } from '../theme';
import { ARROW_STYLES } from '../skinSpecs';
import { SEASONAL_REWARD_IDS } from '../rewardCatalogue';

const mockState = { current: null as any };
const mockOwned = new Set<number>();
jest.mock('../useRewards', () => ({ useRewards: () => mockState.current }));
jest.mock('../rewardLedger', () => ({
  ...jest.requireActual('../rewardLedger'),
  isRewardOwned: (id: number) => mockOwned.has(id),
  isRewardNew: () => false,
  etaFor: () => 4,
  markPickerSeen: () => {},
}));
jest.mock('../arrowStyleSelection', () => ({ ...jest.requireActual('../arrowStyleSelection'), chooseArrowStyle: () => {} }));
jest.mock('../useArrowStyle', () => ({ useArrowStyle: () => ({ id: 'classic' }), skinPickerEnabled: () => true }));
import { ArrowStyleOptions } from '../ArrowStyleOptions';
import { REWARD_PATH } from '../rewardCatalogue';

const OCT = new Date(2026, 9, 15, 12), DEC = new Date(2026, 11, 10, 12);
const SEASONAL_NAMES = ['Pumpkin', 'Ghost', 'Candy Corn'];
const ORDINARY = ARROW_STYLES.filter(s => !SEASONAL_REWARD_IDS.includes(s.numericId));
const state = (extra: object) => ({ points: 4, owned: { lo: 0, hi: 0 }, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 4,
  progress: .2, newMask: { lo: 0, hi: 0 }, petals: 30, canBuy: true, seasons: true, ...extra });
beforeEach(() => { mockOwned.clear(); [0, 2, 4, 6].forEach(id => mockOwned.add(id)); });

test('in season: "Book · N" counts the visible seasonal styles too', () => {
  mockState.current = state({});
  const { getByText } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} now={OCT} />);
  getByText('Your styles · 4'); getByText('Book · 19'); // 14 path + 5 Halloween (HALLOWEEN-PLUS added Mummy and Potion Slime)
});

test('out of season: an owned seasonal style stays in "Your styles"; unowned ones leave the count', () => {
  mockOwned.add(18);
  mockState.current = state({});
  const { getByText, getAllByRole } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} now={DEC} />);
  getByText('Your styles · 5'); getByText('Book · 14');
  expect(getAllByRole('radio').map(r => r.props.accessibilityLabel)).toEqual(['Classic', 'Sherbet', 'Candy Gloss', 'Critter', 'Pumpkin']);
  fireEvent.press(getByText('Book · 14'));
});

test('seasons off with the book on: an owned seasonal bit is never listed or counted', () => {
  mockOwned.add(18);
  mockState.current = state({ seasons: false });
  const { getByText, queryByLabelText } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} now={OCT} />);
  getByText('Your styles · 4'); getByText('Book · 14');
  expect(queryByLabelText('Pumpkin')).toBeNull();
});

test('path layout (book off): the total is the visible total, and seasonal styles are absent', () => {
  mockOwned.add(18);
  mockState.current = state({ petals: null, canBuy: false, seasons: false });
  const { getByText, queryByLabelText } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} now={OCT} />);
  getByText(`4 of ${ORDINARY.length}`);
  expect(queryByLabelText('Pumpkin')).toBeNull();
});

test('rewards off: the flat picker lists exactly today\'s styles, never a seasonal one', () => {
  mockState.current = null;
  const { getAllByRole } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} now={OCT} />);
  const labels = getAllByRole('radio').map(r => r.props.accessibilityLabel);
  expect(labels).toEqual(ORDINARY.map(s => s.name));
  for (const name of SEASONAL_NAMES) expect(labels).not.toContain(name);
});
