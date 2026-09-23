import { readGridLines, setGridLines, subscribeGridLines } from '../gridLinesSession';

describe('gridLinesSession (ruling R5: session-only "#" state)', () => {
  it('starts OFF, toggles, notifies subscribers once per change', () => {
    expect(readGridLines()).toBe(false);
    const seen: boolean[] = [];
    const unsubscribe = subscribeGridLines(() => seen.push(readGridLines()));
    setGridLines(true);
    setGridLines(true); // no change, no notification
    setGridLines(false);
    unsubscribe();
    setGridLines(true);
    expect(seen).toEqual([true, false]);
    expect(readGridLines()).toBe(true);
    setGridLines(false);
  });

  it('is not persisted: the module imports no storage', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const source = require('fs').readFileSync(require.resolve('../gridLinesSession'), 'utf8') as string;
    expect(source).not.toMatch(/import/);
  });
});
