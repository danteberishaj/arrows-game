// W3-17 parser tests. Run: node --test scripts/analysis/ftue-playtest-tables.test.mjs
// The two fixtures are unedited `adb logcat -v time -s ReactNativeJS:I` captures from the W3-17 emulator dry run
// (emulator-5556, the V2 and V1 playtest APKs; docs/next-level/reports/W3-17-prep.md). Their numbers were checked
// against the screen there: the win panels read "Level 1 · Diamond · 24 arrows", "Level 2 · Teacup · 23 arrows" and
// "Level 1 · Circle · 60 arrows", and the header hearts / win stars matched each clear line. Negative cases edit
// those real lines in memory.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  MalformedInput,
  buildAttempts,
  loadSessions,
  median,
  outcomeOf,
  parseFtueLines,
  parseSessionName,
  reconciliationOf,
  renderMarkdown,
} from './ftue-playtest-tables.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures/ftue-playtest');
const V2 = readFileSync(join(FIX, 'DRY1-1-V2.txt'), 'utf8');
const V1 = readFileSync(join(FIX, 'DRY1-2-V1.txt'), 'utf8');
const SCRIPT = join(HERE, 'ftue-playtest-tables.mjs');

const attemptsOf = (text, build) => buildAttempts(parseFtueLines(text, 'x'), { build, file: 'x' });
const summary = (a) => ({
  label: a.label, shape: a.shape, arrows: a.arrows, gen: a.gen, removals: a.removals, blocked: a.blocked,
  charged: a.charged, grace: a.freeGrace, assist: a.freeAssist, repeat: a.freeRepeat, clearMs: a.clearMs,
  outcome: outcomeOf(a), recon: reconciliationOf(a),
});
const withLines = (text, edit) => text.split('\n').flatMap((line, i) => edit(line, i + 1) ?? []).join('\n');
const sessionsFrom = (files) => loadSessions(Object.keys(files), (p) => files[p]);

test('V2 dry run: every board, as the screen showed it', () => {
  const { attempts, problems } = attemptsOf(V2, 'V2');
  assert.deepEqual(problems, []);
  assert.deepEqual(attempts.map(summary), [
    { label: 'T1', shape: '', arrows: 6, gen: 1, removals: 6, blocked: 0, charged: 0, grace: 0, assist: 0, repeat: 0, clearMs: 9480, outcome: 'cleared', recon: '6/6 ok' },
    { label: 'T2', shape: '', arrows: 5, gen: 1, removals: 5, blocked: 2, charged: 1, grace: 1, assist: 0, repeat: 0, clearMs: 12054, outcome: 'cleared', recon: '5/5 ok' },
    { label: 'L1', shape: 'Diamond', arrows: 24, gen: 2, removals: 24, blocked: 2, charged: 1, grace: 0, assist: 1, repeat: 0, clearMs: 28385, outcome: 'cleared', recon: '24/24 ok' },
    { label: 'L2', shape: 'Teacup', arrows: 23, gen: 2, removals: 23, blocked: 3, charged: 1, grace: 0, assist: 1, repeat: 1, clearMs: 27868, outcome: 'cleared', recon: '23/23 ok' },
  ]);
  // Hearts left at each clear: 3, 2, 2, 2 (header pips and win stars in the dry-run screenshots).
  assert.deepEqual(attempts.map((a) => a.hearts), [3, 2, 2, 2]);
  // W1-09's observable: one charged blocked tap on T2 after the grace (lesson) tap.
  assert.equal(attempts[1].lessonAt, 4151);
  assert.equal(attempts[1].blockedAfterLesson, 1);
});

test('V1 dry run: a loss, Retry, then a perfect clear of the 60-arrow Circle', () => {
  const { attempts, problems } = attemptsOf(V1, 'V1');
  assert.deepEqual(problems, []);
  assert.deepEqual(attempts.map((a) => [a.label, a.removals, a.charged, a.hearts, outcomeOf(a), reconciliationOf(a)]), [
    ['T1', 6, 0, 3, 'cleared', '6/6 ok'],
    ['T2', 5, 0, 3, 'cleared', '5/5 ok'],
    ['L1', 1, 3, 0, 'lost all hearts → Retry', '1/60 (not cleared)'],
    ['L1', 60, 0, 3, 'cleared', '60/60 ok'],
  ]);
  assert.equal(attempts[2].losses, 1);
  assert.equal(attempts[3].firstRemovalMs, 10312);
});

test('the rendered doc tables: one row per attempt, n / median / max summaries, pass-rule inputs', () => {
  const sessions = sessionsFrom({ 'DRY1-1-V2.txt': V2, 'DRY1-2-V1.txt': V1 });
  const { markdown, problems } = renderMarkdown(sessions);
  assert.deepEqual(problems, []);
  assert.match(markdown, /\| DRY1 \| 1 \| V2 \| 3 \| L1 \| Diamond \| 24 \| 2 \| 26 \| 2 \(1 \/ 0, 1, 0\) \| 24 \| 1 \| 7\.4 \| 28\.4 \| cleared \| 24\/24 ok \|/);
  assert.match(markdown, /\| DRY1 \| 2 \| V1 \| 3 \| L1 \| Circle \| 60 \| 1 \| 4 \| 3 \(3 \/ 0, 0, 0\) \| 1 \| 3 \| 5\.2 \| — \| lost all hearts → Retry \| 1\/60 \(not cleared\) \|/);
  // V1 L1 pools both attempts: 65 taps, 4 blocked, 3 hearts lost; cleared but not clean.
  assert.match(markdown, /\| V1 \| L1 \| 1 \| 1 \| 0 \| 65 \/ 65 \| 4 \/ 4 \| 3 \/ 3 \| 62\.6 \/ 62\.6 \(1\) \|/);
  assert.match(markdown, /\*\*V2, first session only:\*\* 1 of 1 sessions cleared level 1 without losing all hearts/);
  assert.match(markdown, /\*\*V1, all sessions:\*\* 0 of 1 sessions cleared level 1 without losing all hearts/);
  assert.match(markdown, /Too-easy signal.*: none\./);
  assert.doesNotMatch(markdown, /\bp\d\d\b/); // no p50/p75/p95 anywhere
  assert.match(markdown, /#### DRY1-1-V2\.txt\n\n```\n10-06 12:09:04\.348 I\/ReactNativeJS\( 6823\): \[ftue\] board_mount T1 0 gen=1 arrows=6 shape=\n/);
});

test('too-easy signal fires for levels 1-5 cleared with zero blocked taps', () => {
  // Real V2 lines with the blocked taps removed and levels 3-5 added as copies of level 2's clean run.
  const clean = withLines(V2, (l) => (/\[ftue\] blocked /.test(l) ? null : l.replace(/clear 2 /, 'clear 3 ')));
  const lines = clean.split('\n');
  const start = lines.findIndex((l) => l.includes('board_mount 1 0'));
  const l2 = lines.slice(start).filter((l) => l.includes('[ftue]'));
  const more = [2, 3, 4].flatMap((i) => l2.map((l) => l.replace('board_mount 1 0', `board_mount ${i} 0`)));
  const sessions = sessionsFrom({ 'P9-1-V2.txt': [clean, ...more].join('\n') });
  assert.deepEqual(sessions[0].problems, []);
  assert.match(renderMarkdown(sessions).markdown, /Too-easy signal.*: P9-1-V2\./);
});

test('median and max only: the median of an even count is the mean of the middle pair', () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test('accepts -v threadtime and bare lines, and ignores every non-[ftue] line', () => {
  const tt = '10-06 12:09:04.348  6823  6850 I ReactNativeJS: [ftue] board_mount 0 0 gen=2 arrows=24 shape=Diamond';
  const ev = parseFtueLines(`--------- beginning of main\n${tt}\n[ftue] removal 12\r\nnoise`, 'x');
  assert.deepEqual(ev.map((e) => [e.type, e.pid, e.t]), [['board_mount', 6823, 0], ['removal', null, 12]]);
});

test('malformed input throws with the file and line', () => {
  const bad = [
    [withLines(V2, (l, n) => (n === 5 ? l.replace(/removal \d+/, 'removal') : l)), /x:5: malformed \[ftue\] line/],
    [withLines(V2, (l, n) => (n === 5 ? l.replace('removal', 'tap') : l)), /x:5: malformed/],
    [withLines(V2, (l, n) => (n === 14 ? l.replace('none', 'maybe') : l)), /x:14: malformed/],
    [withLines(V2, (l, n) => (n === 5 ? `garbage ${l.slice(l.indexOf('[ftue]'))}` : l)), /x:5: unrecognised prefix/],
    [withLines(V2, (l, n) => (n === 4 ? l.replace('T1 0 gen', 'T1 7 gen') : l)), /x:4: board_mount must have t = 0/],
    ['--------- beginning of main\n10-06 12:08:58.014 I/ReactNativeJS( 6823): Running "main"\n', /no \[ftue\] lines/],
    [withLines(V2, (l, n) => (n === 4 ? null : l)), /the first \[ftue\] line must be a board_mount/],
  ];
  for (const [text, re] of bad) {
    assert.throws(() => buildAttempts(parseFtueLines(text, 'x'), { file: 'x' }), (e) => e instanceof MalformedInput && re.test(e.message));
  }
  // Structural impossibilities found while replaying the events.
  const swap = withLines(V2, (l, n) => (n === 6 ? l.replace('removal 5583', 'removal 100') : l));
  assert.throws(() => attemptsOf(swap, 'V2'), /x:6: t went backwards/);
  const mixed = withLines(V2, (l, n) => (n === 6 ? l.replace('( 6823)', '( 7001)') : l));
  assert.throws(() => attemptsOf(mixed, 'V2'), /process 7001 on a board mounted by process 6823/);
  const afterClear = withLines(V2, (l, n) => (n === 11 ? [l, l.replace(/clear 3 9480/, 'removal 9600')] : l));
  assert.throws(() => attemptsOf(afterClear, 'V2'), /x:12: removal after T1's clear/);
});

test('integrity failures: a dropped removal, a heart count, a mislabelled build, an impossible restart', () => {
  const dropped = withLines(V2, (l, n) => (n === 30 ? null : l));
  const d = attemptsOf(dropped, 'V2');
  assert.equal(reconciliationOf(d.attempts[2]), 'MISMATCH 23/24');
  assert.ok(d.problems.some((p) => /L1 removals 23 vs arrowCount 24 \(cleared\)/.test(p)));

  const hearts = withLines(V2, (l) => l.replace('clear 2 28385', 'clear 3 28385'));
  assert.ok(attemptsOf(hearts, 'V2').problems.some((p) => /L1 clear says 3 hearts left; the log's taps give 2/.test(p)));

  assert.ok(attemptsOf(V2, 'V1').problems.some((p) => /L1 is gen=2 in a V1 session/.test(p)));

  const early = withLines(V1, (l, n) => (n === 23 || n === 24 ? null : l));
  assert.ok(attemptsOf(early, 'V1').problems.some((p) => /restart on L1 with 2 hearts left/.test(p)));
});

test('a tap after all hearts are gone is an inferred rewarded continue (hearts back to 1)', () => {
  // V1's lost attempt, then real removal lines from the cleared attempt re-timed after the loss, then the clear.
  const lines = V1.split('\n');
  const lost = lines.slice(0, 24);
  const removals = lines.slice(27, 87).filter((l) => l.includes('removal')).slice(0, 59)
    .map((l, i) => l.replace(/removal \d+$/, `removal ${40000 + i * 700}`));
  const text = [...lost, ...removals, lines[87].replace('clear 3 62593', 'clear 1 90000')].join('\n');
  const { attempts, problems } = attemptsOf(text, 'V1');
  assert.deepEqual(problems, []);
  assert.equal(attempts.length, 3);
  assert.equal(attempts[2].continues, 1);
  assert.equal(outcomeOf(attempts[2]), 'cleared after 1 continue (inferred)');
  assert.equal(reconciliationOf(attempts[2]), '60/60 ok');
});

test('session files: names, duplicates, and order', () => {
  assert.deepEqual(parseSessionName('/a/P3-2-V1.txt'), { participant: 'P3', order: 2, build: 'V1' });
  assert.throws(() => parseSessionName('P3-V1.txt'), MalformedInput);
  assert.throws(() => sessionsFrom({ 'P1-1-V2.txt': V2, 'P1-1-V1.txt': V1 }), /two files for P1 session 1/);
  assert.throws(() => sessionsFrom({ 'P1-2-V1.txt': V1 }), /session 2 without a session 1/);
  assert.throws(() => sessionsFrom({ 'P1-1-V2.txt': V2, 'P1-2-V2.txt': V2 }), /played V2 twice/);
  const notFresh = withLines(V2, (l, n) => (n >= 4 && n <= 20 ? null : l));
  assert.match(sessionsFrom({ 'P1-1-V2.txt': notFresh })[0].warnings[0], /first board is L1, not T1/);
});

test('CLI exit codes: 0 tables, 1 malformed, 2 usage, 3 integrity', () => {
  const dir = mkdtempSync(join(tmpdir(), 'w317-'));
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  const ok = run(join(FIX, 'DRY1-1-V2.txt'), join(FIX, 'DRY1-2-V1.txt'));
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /### Per participant and board attempt/);
  writeFileSync(join(dir, 'P1-1-V2.txt'), withLines(V2, (l, n) => (n === 5 ? l.replace(/removal \d+/, 'removal x') : l)));
  const bad = run(join(dir, 'P1-1-V2.txt'));
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /MALFORMED: P1-1-V2\.txt:5/);
  assert.equal(bad.stdout, '');
  assert.equal(run().status, 2);
  assert.equal(run(join(dir, 'missing-1-V2.txt')).status, 1);
  writeFileSync(join(dir, 'P2-1-V2.txt'), withLines(V2, (l, n) => (n === 30 ? null : l)));
  const mismatch = run('--out', join(dir, 'out.md'), join(dir, 'P2-1-V2.txt'));
  assert.equal(mismatch.status, 3);
  assert.match(mismatch.stderr, /INTEGRITY FAILED \(1\)/);
  assert.match(readFileSync(join(dir, 'out.md'), 'utf8'), /MISMATCH 23\/24/);
});
