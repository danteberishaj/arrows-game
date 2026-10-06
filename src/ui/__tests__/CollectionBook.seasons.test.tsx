// src/ui/__tests__/CollectionBook.seasons.test.tsx — HALLOWEEN-01: the seasonal book section.
import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { Daylight } from '../theme';
import { REWARD_PATH } from '../rewardCatalogue';

jest.mock('../haptics', () => ({ Haptic: { cleared: jest.fn() } }));
const mockBuy = jest.fn();
const mockOwned = new Set<number>([0, 2, 4, 6]);
jest.mock('../rewardLedger', () => ({
  ...jest.requireActual('../rewardLedger'),
  buyReward: (id: number, now: Date) => mockBuy(id, now),
  isRewardOwned: (id: number) => mockOwned.has(id),
  etaFor: () => null,
}));
import { CollectionBook } from '../CollectionBook';

const OCT = new Date(2026, 9, 15, 12), DEC = new Date(2026, 11, 10, 12);
const base = { points: 4, owned: { lo: 0, hi: 0 }, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 4, progress: .2,
  newMask: { lo: 0, hi: 0 }, canBuy: true, petals: 30, seasons: true };
beforeEach(() => { mockBuy.mockReset(); mockOwned.clear(); [0, 2, 4, 6].forEach(id => mockOwned.add(id)); });

test('in season: a Halloween section at the TOP with a drawn pumpkin and the unowned seasonal tiles', () => {
  const { getByTestId, getByText } = render(<CollectionBook palette={Daylight} state={base} onUse={() => {}} now={OCT} />);
  const section = getByTestId('book-season-halloween');
  getByText('Halloween · until 7 Nov');
  within(section).getByTestId('pumpkin-icon');
  const labels = within(section).getAllByRole('button').map(b => b.props.accessibilityLabel);
  // HALLOWEEN-PLUS (owner pick 2026-10-06): Mummy and Potion Slime join the section, in catalogue order.
  expect(labels).toEqual(['Pumpkin, 20 petals', 'Ghost, 20 petals', 'Candy Corn, 20 petals', 'Mummy, 20 petals', 'Potion Slime, 20 petals']);
  // The season section comes before the path grid.
  const tree = JSON.stringify(render(<CollectionBook palette={Daylight} state={base} onUse={() => {}} now={OCT} />).toJSON());
  expect(tree.indexOf('book-season-halloween')).toBeLessThan(tree.indexOf('book-tile-cinnamon'));
});

test('an owned seasonal style leaves the book; buying passes the date and shows visible counts', () => {
  mockOwned.add(18);
  mockBuy.mockImplementation(() => { mockOwned.add(19); return 'bought'; });
  const { getByTestId, queryByTestId, getByText } = render(<CollectionBook palette={Daylight} state={base} onUse={() => {}} now={OCT} />);
  expect(queryByTestId('book-tile-pumpkin')).toBeNull();
  fireEvent.press(getByTestId('book-tile-ghost'));
  getByText('Buy for 20 petals');
  fireEvent.press(getByTestId('book-buy'));
  expect(mockBuy).toHaveBeenCalledWith(19, OCT);
  // Visible: 18 ordinary + Pumpkin/Ghost (owned) + Candy Corn, Mummy, Potion Slime (in season) = 23; owned 4 + 2.
  getByText('6 of 23 styles collected');
});

test('out of season: unowned seasonal styles are hidden and no section is drawn', () => {
  const { queryByTestId, queryByText } = render(<CollectionBook palette={Daylight} state={base} onUse={() => {}} now={DEC} />);
  expect(queryByTestId('book-season-halloween')).toBeNull();
  expect(queryByTestId('book-tile-ghost')).toBeNull();
  expect(queryByText(/Halloween/)).toBeNull();
});

test('seasons off: nothing seasonal even in October', () => {
  const { queryByTestId } = render(<CollectionBook palette={Daylight} state={{ ...base, seasons: false }} onUse={() => {}} now={OCT} />);
  expect(queryByTestId('book-season-halloween')).toBeNull();
  expect(queryByTestId('book-tile-pumpkin')).toBeNull();
});

test('path complete but the season is open: the season section shows, not the empty line', () => {
  REWARD_PATH.forEach(e => mockOwned.add(e.rewardId));
  const { getByTestId, queryByTestId } = render(<CollectionBook palette={Daylight} state={{ ...base, next: null }} onUse={() => {}} now={OCT} />);
  getByTestId('book-season-halloween');
  expect(queryByTestId('book-empty')).toBeNull();
  const off = render(<CollectionBook palette={Daylight} state={{ ...base, next: null }} onUse={() => {}} now={DEC} />);
  off.getByTestId('book-empty');
});
