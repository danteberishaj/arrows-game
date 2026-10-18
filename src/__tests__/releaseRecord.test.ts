/**
 * release/vc*.env is the as-shipped record of a Play build: the exact EXPO_PUBLIC_* set it was built with. A flag
 * the source never reads is a typo that silently ships the default; a PERF_/DEV_ flag or ADMOB_TEST_ADS must never
 * reach a player; and the consent mode is a release decision, so every record states it.
 */
import fs from 'fs';
import path from 'path';

/* eslint-disable @typescript-eslint/no-require-imports */
const { readRecord, recordFiles } = require('../../scripts/release-record') as {
  readRecord: (file: string) => { flags: Map<string, string>; comments: string[] };
  recordFiles: () => string[];
};

const SRC = path.join(__dirname, '..');

function sourceText(dir: string): string {
  let out = '';
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue; // a flag read only by a test is not a product flag
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out += sourceText(full);
    else if (/\.tsx?$/.test(entry.name)) out += fs.readFileSync(full, 'utf8');
  }
  return out;
}

const src = sourceText(SRC);

test('the vc18 record exists', () => {
  expect(recordFiles().map((f) => path.basename(f))).toContain('vc18.env');
});

for (const file of recordFiles()) describe(path.basename(file), () => {
  const { flags, comments } = readRecord(file);

  test('every flag is read somewhere in src/ (exact name)', () => {
    expect(flags.size).toBeGreaterThan(0);
    const missing = [...flags.keys()].filter((name) => !new RegExp(`\\b${name}(?![A-Z0-9_])`).test(src));
    expect(missing).toEqual([]);
  });

  test('no PERF_, DEV_ or ADMOB_TEST_ADS flag', () => {
    const banned = [...flags.keys()].filter((name) =>
      /^EXPO_PUBLIC_(PERF_|DEV_|ADMOB_TEST_ADS$)/.test(name),
    );
    expect(banned).toEqual([]);
  });

  test('a consent decision line is present', () => {
    expect(comments.some((line) => /^# consent: /.test(line))).toBe(true);
  });
});
