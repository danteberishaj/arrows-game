// NEW-YEAR-01 / WINTER-01: seasonal book sections with per-season icons, honest previews, and seasonNow() defaults.
import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Daylight, InkNight } from '../theme';
import { REWARD_PATH } from '../rewardCatalogue';
import { ARROW_STYLES } from '../skinSpecs';

jest.mock('../haptics', () => ({ Haptic: { cleared: jest.fn() } }));
const mockBuy = jest.fn();
const mockOwned = new Set<number>();
const mockNow = { current: new Date(2026, 11, 10, 12) };
jest.mock('../seasonClock', () => ({ seasonNow: () => mockNow.current }));
jest.mock('../rewardLedger', () => ({
  ...jest.requireActual('../rewardLedger'),
  buyReward: (id: number, now: Date) => mockBuy(id, now),
  isRewardOwned: (id: number) => mockOwned.has(id),
  isRewardNew: () => false,
  etaFor: () => null,
  markPickerSeen: () => {},
}));
const mockState = { current: null as any };
jest.mock('../useRewards', () => ({ useRewards: () => mockState.current }));
jest.mock('../arrowStyleSelection', () => ({ ...jest.requireActual('../arrowStyleSelection'), chooseArrowStyle: () => {} }));
jest.mock('../useArrowStyle', () => ({ useArrowStyle: () => ({ id: 'classic' }), skinPickerEnabled: () => true }));
import { CollectionBook, SeasonIcon } from '../CollectionBook';
import { ArrowStyleOptions, StylePreview } from '../ArrowStyleOptions';

const FROZEN = JSON.parse(readFileSync(join(__dirname, 'winterSkins.frozen.json'), 'utf8')) as { preview: Record<string, string> };
const DEC = new Date(2026, 11, 10, 12), LATE_JAN = new Date(2027, 0, 20, 12);
const base = { points: 4, owned: { lo: 0, hi: 0 }, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 4, progress: .2,
  newMask: { lo: 0, hi: 0 }, canBuy: true, petals: 30, seasons: true };
beforeEach(() => { mockBuy.mockReset(); mockOwned.clear(); [0, 2, 4, 6].forEach(id => mockOwned.add(id)); mockNow.current = DEC; });
const style = (id: string) => ARROW_STYLES.find(s => s.id === id)!;
// react-native-svg serialises colours as ARGB integers; map them back to '#RRGGBB' for readable assertions.
const fills = (id: string) => JSON.stringify(render(<StylePreview style={style(id)} palette={Daylight} />).toJSON())
  .replace(/"payload":(\d+)/g, (_, n) => `"#${(Number(n) & 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0')}"`);

test('earlier thumbnails are unchanged (render-tree hashes captured before this change)', () => {
  expect(Object.keys(FROZEN.preview)).toHaveLength(23 * 4);
  for (const key of Object.keys(FROZEN.preview)) {
    const [id, theme, size] = key.split(':');
    const tree = render(<StylePreview style={style(id)} palette={theme === 'd' ? Daylight : InkNight} size={Number(size)} />).toJSON();
    expect([key, createHash('sha256').update(JSON.stringify(tree)).digest('hex')]).toEqual([key, FROZEN.preview[key]]);
  }
});

test('new previews show their defining features', () => {
  const confetti = fills('confetti');
  expect(confetti).toContain('#FFD24A'); expect(confetti).toContain('#80C8BC');
  const snowfall = fills('snowfall');
  expect(snowfall).toContain('#FFFFFF'); expect(snowfall).toContain('#DCEBFF');
  const snowman = fills('snowman');
  expect(snowman).toContain('#2B2B33'); // coal eyes + buttons over the snowball beads
  expect(render(<StylePreview style={style('snowman')} palette={Daylight} />).toJSON()).toBeTruthy();
  const gold = fills('golden-ribbon');
  expect(gold).toContain('#FFDF8A'); expect(gold).toContain('#FFF4D0');
  expect(fills('frosted-glass')).toContain('#F7F4FF');
});

test('Dec 10: New Year and Winter sections render together, each with its own decorative icon', () => {
  const { getByTestId, getByText } = render(<CollectionBook palette={Daylight} state={base} onUse={() => {}} now={DEC} />);
  const ny = within(getByTestId('book-season-new-year')), winter = within(getByTestId('book-season-winter'));
  getByText('New Year · until 15 Jan'); getByText('Winter · until 29 Feb');
  ny.getByTestId('season-icon-new-year'); winter.getByTestId('season-icon-winter');
  expect(ny.queryByTestId('season-icon-winter')).toBeNull();
  expect(ny.queryByTestId('pumpkin-icon')).toBeNull();
  expect(ny.getAllByRole('button').map(b => b.props.accessibilityLabel)).toEqual(['Frosted Glass, 20 petals', 'Golden Ribbon, 20 petals', 'Confetti, 20 petals']);
  expect(winter.getAllByRole('button').map(b => b.props.accessibilityLabel)).toEqual(['Snowman, 20 petals', 'Snowfall, 20 petals']);
  fireEvent.press(getByTestId('book-tile-confetti'));
  mockBuy.mockReturnValue('bought');
  fireEvent.press(getByTestId('book-buy'));
  expect(mockBuy).toHaveBeenCalledWith(26, DEC);
});

test('icons are explicit per season id and decorative; unknown seasons get a neutral mark', () => {
  const ids = ['halloween', 'new-year', 'winter', 'spring'].map(id => {
    const tree = render(<SeasonIcon id={id} palette={Daylight} />).toJSON() as any;
    expect(tree.props.accessible).toBe(false);
    return tree.props.testID;
  });
  expect(ids).toEqual(['pumpkin-icon', 'season-icon-new-year', 'season-icon-winter', 'season-icon-generic']);
});

test('Jan 20: only Winter; an owned New Year style is not sold but stays owned', () => {
  mockOwned.add(24);
  const { queryByTestId, getByTestId } = render(<CollectionBook palette={Daylight} state={base} onUse={() => {}} now={LATE_JAN} />);
  expect(queryByTestId('book-season-new-year')).toBeNull();
  getByTestId('book-season-winter');
});

test('seasons off: no New Year or Winter section in December', () => {
  const { queryByTestId } = render(<CollectionBook palette={Daylight} state={{ ...base, seasons: false }} onUse={() => {}} now={DEC} />);
  expect(queryByTestId('book-season-new-year')).toBeNull();
  expect(queryByTestId('book-season-winter')).toBeNull();
});

test('CollectionBook and ArrowStyleOptions default `now` to seasonNow() (QA date), not the real clock', () => {
  mockNow.current = DEC;
  const book = render(<CollectionBook palette={Daylight} state={base} onUse={() => {}} />);
  book.getByTestId('book-season-new-year');
  mockNow.current = new Date(2026, 5, 10, 12);
  expect(render(<CollectionBook palette={Daylight} state={base} onUse={() => {}} />).queryByTestId('book-season-new-year')).toBeNull();
  mockNow.current = DEC;
  mockState.current = { ...base };
  const picker = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} />);
  picker.getByText('Book · 22'); // 14 path + 3 New Year + 2 Winter + 3 Christmas (CHRISTMAS-01)
});
