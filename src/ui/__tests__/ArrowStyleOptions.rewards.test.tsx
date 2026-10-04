// src/ui/__tests__/ArrowStyleOptions.rewards.test.tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Daylight } from '../theme';

const mockState = { current: null as any };
const mockChoose = jest.fn();
const mockMarkPickerSeen = jest.fn();
const mockNew = new Set<number>();
const mockEta = new Map<number, number>();
const mockOwned = new Set([0, 2, 4, 6]);
jest.mock('../useRewards', () => ({ useRewards: () => mockState.current }));
jest.mock('../rewardLedger', () => ({
  ...jest.requireActual('../rewardLedger'),
  isRewardOwned: (id: number) => mockOwned.has(id),
  isRewardNew: (id: number) => mockNew.has(id),
  etaFor: (id: number) => mockEta.get(id) ?? null,
  markPickerSeen: () => mockMarkPickerSeen(),
}));
jest.mock('../arrowStyleSelection', () => ({ ...jest.requireActual('../arrowStyleSelection'), chooseArrowStyle: (id: string) => mockChoose(id) }));
jest.mock('../useArrowStyle', () => ({ useArrowStyle: () => ({ id: 'sherbet' }), skinPickerEnabled: () => true }));
import { ArrowStyleOptions } from '../ArrowStyleOptions';
import { REWARD_PATH } from '../rewardCatalogue';

beforeEach(() => { mockNew.clear(); mockEta.clear(); mockEta.set(1, 4); mockEta.set(5, 10); mockChoose.mockClear(); mockMarkPickerSeen.mockClear(); mockOwned.clear(); [0, 2, 4, 6].forEach(id => mockOwned.add(id)); });

test('owned styles first with a count, then the path with the next one highlighted', () => {
  mockState.current = { points: 4, owned: { lo: 0, hi: 0 }, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 4, progress: .2, newMask: { lo: 0, hi: 0 }, petals: null, canBuy: false };
  const { getByTestId, getByText } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} />);
  getByTestId('reward-section-owned'); getByText('4 of 18');
  getByTestId('reward-section-coming');
  getByText('Next · 4 levels');
  getByText('After Cinnamon Roll');
  expect(mockMarkPickerSeen).toHaveBeenCalledTimes(1);
});

test('tapping a locked style never selects it and shows the hint', () => {
  mockState.current = { points: 4, owned: { lo: 0, hi: 0 }, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 4, progress: .2, newMask: { lo: 0, hi: 0 }, petals: null, canBuy: false };
  const { getByLabelText, getByTestId } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} />);
  fireEvent.press(getByLabelText('Jelly, locked, unlocks in 10 levels'));
  expect(mockChoose).not.toHaveBeenCalled();
  expect(getByTestId('reward-locked-hint').props.children).toBe('Clear 10 more levels to unlock');
});

test('owned rows follow catalogue order: free styles first, then path order', () => {
  mockState.current = { points: 4, owned: { lo: 0, hi: 0 }, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 4, progress: .2, newMask: { lo: 0, hi: 0 }, petals: null, canBuy: false };
  const { getAllByRole } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} />);
  const owned = getAllByRole('radio').map(r => r.props.accessibilityLabel);
  expect(owned).toEqual(['Classic', 'Sherbet', 'Candy Gloss', 'Critter']);
});

test('a style owned beyond the points reached has no "new" dot, and opening the picker clears reached dots', () => {
  mockState.current = { points: 3, owned: { lo: 0, hi: 0 }, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 5, progress: 0, newMask: { lo: 0, hi: 0 }, petals: null, canBuy: false };
  mockNew.add(6);
  mockOwned.add(12); // Rainbow Ribbon, selected before the path existed
  const { getByLabelText } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} />);
  getByLabelText('Critter, new'); // reached since last open
  getByLabelText('Rainbow Ribbon'); // owned beyond reachedIndex: no dot
  expect(mockMarkPickerSeen).toHaveBeenCalled();
});

test('rewards off: today\'s flat list, every style selectable', () => {
  mockState.current = null;
  const { getByLabelText, queryByTestId } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} />);
  expect(queryByTestId('reward-section-owned')).toBeNull();
  fireEvent.press(getByLabelText('Jelly'));
  expect(mockChoose).toHaveBeenCalledWith('jelly');
});

test('coming up shows the next two styles, then one "+N more to unlock" row', () => {
  mockState.current = { points: 4, owned: { lo: 0, hi: 0 }, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 4, progress: .2, newMask: { lo: 0, hi: 0 }, petals: null, canBuy: false };
  const { getByLabelText, getByText, queryByLabelText } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} />);
  getByLabelText('Cinnamon Roll, locked, unlocks in 4 levels');
  getByLabelText('Jelly, locked, unlocks in 10 levels');
  expect(queryByLabelText(/^Rainbow Ribbon, locked/)).toBeNull();
  getByText('+12 more to unlock');
});

test('book on: purse, tabs, and the next-free line switches to Book', () => {
  mockState.current = { points: 4, owned: { lo: 0, hi: 0 }, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 4, progress: .2, newMask: { lo: 0, hi: 0 }, petals: 18, canBuy: true };
  const { getByTestId, getByText, getByRole } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} />);
  getByText('18 petals');
  expect(getByTestId('tab-styles').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  getByText('Your styles · 4'); getByText('Book · 14');
  fireEvent.press(getByTestId('next-free-line')); // "Next free style: Cinnamon Roll · 4 levels"
  expect(getByTestId('tab-book').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
});

test('book off: skip-aware Coming up ETA uses the next step for Cinnamon', () => {
  mockState.current = { points: 0, owned: { lo: 0, hi: 0 }, reachedIndex: 0, next: REWARD_PATH[1], levelsToNext: 3, progress: 0, newMask: { lo: 0, hi: 0 }, petals: null, canBuy: false };
  mockEta.set(1, 3);
  const { getByText, getByLabelText } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} />);
  getByText('Next · 3 levels');
  getByLabelText('Cinnamon Roll, locked, unlocks in 3 levels');
});
