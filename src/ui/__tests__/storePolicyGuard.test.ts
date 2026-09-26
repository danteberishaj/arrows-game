/**
 * W4-11 store-policy guard: makes the review rules a repeatable check instead
 * of a review note. Google Play forbids asking the player anything before or
 * while the review card shows (opinion or predictive questions) and any
 * incentive; Apple allows only the system prompt (App Review 5.6.1). So:
 * - no player-facing wording that pre-gates or steers a rating anywhere under
 *   src/ (code, copy, tests and comments alike);
 * - exactly one call site of the store-review request, in GameScreen.tsx (no
 *   button, no second trigger).
 * This file is the only one excluded: it has to spell the patterns out.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../..');
const SELF = path.resolve(__filename);

const FORBIDDEN = /rate us|enjoying (arrows|the game)|leave a review|5 stars/i;
// Built from parts so this file never contains the call it counts.
const CALL = ['request', 'Review('].join('');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const files = sourceFiles(SRC).filter((file) => path.resolve(file) !== SELF);

function occurrences(text: string, needle: string): number {
  let count = 0;
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) {
    count += 1;
  }
  return count;
}

test('the scan covers the source tree (a positive control on the walker)', () => {
  const rel = files.map((file) => path.relative(SRC, file));
  expect(rel).toContain(path.join('ui', 'GameScreen.tsx'));
  expect(rel).toContain(path.join('core', 'saveSystem.ts'));
  expect(rel).toContain(path.join('ui', '__tests__', 'GameScreen.collection.test.tsx'));
  expect(files.length).toBeGreaterThan(100);
});

test('no file under src/ pre-gates or steers a rating', () => {
  const hits = files
    .map((file) => ({ file: path.relative(SRC, file), m: fs.readFileSync(file, 'utf8').match(FORBIDDEN) }))
    .filter((hit) => hit.m !== null)
    .map((hit) => `${hit.file}: ${hit.m![0]}`);
  expect(hits).toEqual([]);
});

test('the store-review request is called exactly once, in GameScreen.tsx', () => {
  const sites = files
    .map((file) => ({ file: path.relative(SRC, file), n: occurrences(fs.readFileSync(file, 'utf8'), CALL) }))
    .filter((site) => site.n > 0);
  expect(sites).toEqual([{ file: path.join('ui', 'GameScreen.tsx'), n: 1 }]);
});
