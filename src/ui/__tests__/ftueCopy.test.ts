import * as ftueCopy from '../ftueCopy';

describe('FTUE copy', () => {
  it('exports exactly three colour-independent strings', () => {
    const lines = Object.values(ftueCopy);

    expect(lines).toHaveLength(3);
    expect(lines).toEqual(expect.arrayContaining([
      'Tap an arrow.',
      'One arrow is free. Find it.',
      "Blocked. Clear what's in its way.",
    ]));
    for (const line of lines) {
      expect(typeof line).toBe('string');
      expect(line).not.toMatch(/pink|magenta|rose|red|violet|purple|colou?r/i);
    }
  });
});
