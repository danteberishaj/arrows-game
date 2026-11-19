import { BOARD_LOOKS, cycle, DEFAULT_LOOK, getWinterLook, MENU_LOOKS, seasonFxPayload, setWinterLook, winterDecorOn } from '../winter/winterLook';

const day = (m: number, d: number, y = 2026) => new Date(y, m - 1, d, 12);

describe('winterDecorOn', () => {
  it('is off whenever the flag is off', () => expect(winterDecorOn(day(12, 20), false)).toBe(false));
  it('covers Dec 1 through the end of February, wrapping the year', () => {
    expect(winterDecorOn(day(11, 30), true)).toBe(false);
    expect(winterDecorOn(day(12, 1), true)).toBe(true);
    expect(winterDecorOn(day(1, 1, 2027), true)).toBe(true);
    expect(winterDecorOn(day(2, 28, 2027), true)).toBe(true);
    expect(winterDecorOn(day(2, 29, 2028), true)).toBe(true);
    expect(winterDecorOn(day(3, 1, 2027), true)).toBe(false);
  });
});

describe('winter look store', () => {
  it('starts on the defaults and cycles every variant back round', () => {
    expect(getWinterLook()).toEqual(DEFAULT_LOOK);
    let m = DEFAULT_LOOK.menu;
    for (let i = 0; i < MENU_LOOKS.length; i++) m = cycle(MENU_LOOKS, m);
    expect(m).toBe(DEFAULT_LOOK.menu);
    setWinterLook({ board: cycle(BOARD_LOOKS, DEFAULT_LOOK.board) });
    expect(getWinterLook()).toEqual({ ...DEFAULT_LOOK, board: 'frame' });
    expect(DEFAULT_LOOK.lights).toBe('off'); // META_MENU_TWINKLE is off by default
  });
});

describe('seasonFxPayload', () => {
  const look = { ...DEFAULT_LOOK };
  it('is never sent out of season', () => {
    expect(seasonFxPayload(look, '#EEF4FB', false, false)).toBeUndefined();
  });
  it('encodes mode, board darkness and diag', () => {
    expect(seasonFxPayload({ ...look, exit: 'full' }, '#EEF4FB', false, true)).toBe('1,0,0');
    expect(seasonFxPayload({ ...look, exit: 'lite' }, '#121A2B', true, true)).toBe('2,1,1');
    expect(seasonFxPayload({ ...look, exit: 'off' }, '#FFFFFF', false, true)).toBe('0,0,0');
  });
});
