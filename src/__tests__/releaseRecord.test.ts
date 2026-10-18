/**
 * release/vc*.env is the as-shipped record of a Play build: the exact EXPO_PUBLIC_* set it was built with. A flag
 * the source never reads is a typo that silently ships the default; a flag the source compares with '1' ships OFF
 * unless its value is exactly 1; test, fixture and capture flags must never reach a player; and the consent mode
 * and the record's status (shipped or candidate) are release decisions, so every record states them.
 */
import fs from 'fs';
import path from 'path';

/* eslint-disable @typescript-eslint/no-require-imports */
const { readRecord, recordFiles } = require('../../scripts/release-record') as {
  readRecord: (file: string) => { flags: Map<string, string>; comments: string[]; status: string | null };
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

/** Comments dropped, so a name mentioned only in a doc comment (artConfig.ts: EXPO_PUBLIC_ART_X) is not a read. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Expo inlines only the static `process.env.EXPO_PUBLIC_NAME` form, so that is what a read looks like. */
const reads = (name: string) => new RegExp(`process\\.env\\.${name}(?![A-Z0-9_])`);
const readsAsOne = (name: string) => new RegExp(`process\\.env\\.${name}\\s*===\\s*'1'`);

/** Never in a player build: perf/dev harness flags, Google's test ads, W7-01 consent fixtures, art-skin and capture builds. */
const BANNED = /^EXPO_PUBLIC_(PERF_|DEV_|ADMOB_TEST_ADS$|CONSENT_FIXTURE$|ART_SKIN$|CAPTURE_DIAG$)/;

const src = stripComments(sourceText(SRC));

test('the vc18 record exists', () => {
  expect(recordFiles().map((f) => path.basename(f))).toContain('vc18.env');
});

for (const file of recordFiles()) describe(path.basename(file), () => {
  const { flags, comments, status } = readRecord(file);

  test('every flag is read as process.env.NAME in src/ code (not only in a comment)', () => {
    expect(flags.size).toBeGreaterThan(0);
    const missing = [...flags.keys()].filter((name) => !reads(name).test(src));
    expect(missing).toEqual([]);
  });

  test("a flag the source compares with '1' has the value 1 (\"true\" would ship it OFF)", () => {
    const wrong = [...flags].filter(([name, value]) => readsAsOne(name).test(src) && value !== '1');
    expect(wrong).toEqual([]);
  });

  test('no PERF_, DEV_, ADMOB_TEST_ADS, CONSENT_FIXTURE, ART_SKIN or CAPTURE_DIAG flag', () => {
    expect([...flags.keys()].filter((name) => BANNED.test(name))).toEqual([]);
  });

  test('a status line says shipped or candidate', () => {
    expect(['shipped', 'candidate']).toContain(status);
  });

  test('a consent decision line is present', () => {
    expect(comments.some((line) => /^# consent: /.test(line))).toBe(true);
  });
});
