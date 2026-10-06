#!/usr/bin/env node
/**
 * W3-17: turns saved first-session playtest logcat files into the markdown tables of
 * docs/curve-playtest-2026-10-06.md. It reads only the W1-08 / W3-06 `[ftue]` lines that
 * `src/ui/ftueSessionLog.ts` formats (GameScreen emits them when EXPO_PUBLIC_FTUE_LOG=1):
 *
 *   [ftue] board_mount <T1|T2|levelIndex> 0 gen=<1|2> arrows=<n> shape=<name, empty on tutorials>
 *   [ftue] removal <t>
 *   [ftue] blocked <charged true|false> <none|grace|assist> <t>
 *   [ftue] stall_hint <t>
 *   [ftue] clear <heartsLeft> <t>
 *   [ftue] restart <t>
 *
 * `t` is integer ms since that board's mount. Everything else in the file is ignored.
 *
 * Run:  node scripts/analysis/ftue-playtest-tables.mjs [--out tables.md] [--no-raw] <file>...
 * Each file is one session and must be named <participant>-<order>-<build>.txt|.log, for
 * example P1-1-V2.txt (P1's first session, on the V2 APK) and P1-2-V1.txt.
 *
 * Exit codes: 0 tables written; 1 malformed input (no tables written); 2 usage error;
 * 3 tables written but an integrity check failed (a removal count that does not reconcile
 * with arrowCount, a heart count that does not match the clear line, a gen tag that
 * contradicts the build in the file name, or a restart the code cannot produce).
 *
 * Derived, not logged (no product logging was added for W3-17):
 * - taps = removals + blocked taps. Taps on empty cells, pans and pinches are not logged.
 * - hearts lost = blocked taps with charged=true. Every board starts with 3 hearts (all
 *   difficulty configs and both tutorial boards in src/core set hearts: 3); the model is
 *   checked against each clear line's heartsLeft.
 * - a rewarded continue (lose panel, sets hearts to 1) is not logged: it is inferred when
 *   taps continue on a board after its hearts reached 0.
 * - outcome comes from the event order (clear, loss, restart, a new board_mount).
 * Never logged at all: 💡 rewarded-hint use, ads shown, menu visits, the time between boards.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

export const START_HEARTS = 3;

/** A thrown MalformedInput means the input cannot be trusted at all: no tables are written. */
export class MalformedInput extends Error {}

const FILE_NAME = /^([A-Za-z][A-Za-z0-9]*)-([12])-(V1|V2)\.(txt|log)$/;
// adb logcat -v time:        10-06 04:34:21.948 I/ReactNativeJS(22629): [ftue] ...
// adb logcat -v threadtime:  10-06 04:34:21.948 22629 22680 I ReactNativeJS: [ftue] ...
const PREFIX_TIME = /^(\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}) [VDIWEF]\/ReactNativeJS\(\s*(\d+)\): $/;
const PREFIX_THREADTIME = /^(\d\d-\d\d \d\d:\d\d:\d\d\.\d{3})\s+(\d+)\s+\d+ [VDIWEF] ReactNativeJS\s*: $/;
const EVENTS = [
  ['board_mount', /^board_mount (T1|T2|0|[1-9]\d*) (\d+) gen=([12]) arrows=([1-9]\d*) shape=(.*)$/],
  ['removal', /^removal (\d+)$/],
  ['blocked', /^blocked (true|false) (none|grace|assist) (\d+)$/],
  ['stall_hint', /^stall_hint (\d+)$/],
  ['clear', /^clear (\d+) (\d+)$/],
  ['restart', /^restart (\d+)$/],
];

/** Parses a session file name into { participant, order, build }, or throws MalformedInput. */
export function parseSessionName(path) {
  const m = basename(path).match(FILE_NAME);
  if (!m) {
    throw new MalformedInput(`${basename(path)}: file name must be <participant>-<order 1|2>-<V1|V2>.txt, e.g. P1-1-V2.txt`);
  }
  return { participant: m[1], order: Number(m[2]), build: m[3] };
}

/** Returns the [ftue] events of one log text, in file order. Throws MalformedInput on any bad [ftue] line. */
export function parseFtueLines(text, file = '<input>') {
  const events = [];
  const lines = text.split('\n');
  lines.forEach((raw, i) => {
    const line = raw.replace(/\r$/, '');
    const at = line.indexOf('[ftue]');
    if (at < 0) return;
    const where = `${file}:${i + 1}`;
    const prefix = line.slice(0, at);
    let clock = null;
    let pid = null;
    if (prefix !== '') {
      const p = prefix.match(PREFIX_TIME) ?? prefix.match(PREFIX_THREADTIME);
      if (!p) throw new MalformedInput(`${where}: unrecognised prefix before [ftue] (save with adb logcat -v time): ${line}`);
      clock = p[1];
      pid = Number(p[2]);
    }
    if (line.slice(at, at + 7) !== '[ftue] ') throw new MalformedInput(`${where}: malformed [ftue] line: ${line}`);
    const body = line.slice(at + 7);
    for (const [type, re] of EVENTS) {
      const m = body.match(re);
      if (!m) continue;
      const base = { type, line: i + 1, clock, pid, raw: line };
      switch (type) {
        case 'board_mount':
          if (m[2] !== '0') throw new MalformedInput(`${where}: board_mount must have t = 0: ${line}`);
          events.push({ ...base, board: m[1], gen: Number(m[3]), arrows: Number(m[4]), shape: m[5], t: 0 });
          return;
        case 'blocked':
          events.push({ ...base, charged: m[1] === 'true', graceOrAssist: m[2], t: Number(m[3]) });
          return;
        case 'clear':
          events.push({ ...base, heartsLeft: Number(m[1]), t: Number(m[2]) });
          return;
        default:
          events.push({ ...base, t: Number(m[1]) });
          return;
      }
    }
    throw new MalformedInput(`${where}: malformed [ftue] line: ${line}`);
  });
  if (events.length === 0) throw new MalformedInput(`${file}: no [ftue] lines (was the APK built with EXPO_PUBLIC_FTUE_LOG=1, and logcat saved with -s ReactNativeJS:I?)`);
  if (events[0].type !== 'board_mount') throw new MalformedInput(`${file}:${events[0].line}: the first [ftue] line must be a board_mount`);
  return events;
}

/** Board label for tables: T1, T2, or L<index + 1> (the level number the player sees). */
export function boardLabel(board) {
  return board === 'T1' || board === 'T2' ? board : `L${Number(board) + 1}`;
}

/**
 * Splits one session's events into board attempts (one per board_mount) and replays the heart
 * model. Structural impossibilities throw MalformedInput; contradictions with the code's rules
 * are returned as `problems` (integrity failures).
 */
export function buildAttempts(events, session = {}) {
  const file = session.file ?? '<input>';
  const attempts = [];
  const problems = [];
  let cur = null;
  for (const e of events) {
    const where = `${file}:${e.line}`;
    if (e.type === 'board_mount') {
      if (cur) close(cur, e);
      cur = {
        n: attempts.length + 1, board: e.board, label: boardLabel(e.board), tutorial: e.board === 'T1' || e.board === 'T2',
        gen: e.gen, arrows: e.arrows, shape: e.shape, pid: e.pid, mountLine: e.line, clock: e.clock,
        removals: 0, blocked: 0, charged: 0, freeGrace: 0, freeAssist: 0, freeRepeat: 0, stallHints: 0,
        hearts: START_HEARTS, losses: 0, continues: 0, firstRemovalMs: null, clearMs: null, lastMs: 0,
        cleared: false, end: null, lessonAt: null, blockedAfterLesson: 0, restartRequested: false,
      };
      attempts.push(cur);
      if (session.build && !cur.tutorial) {
        const want = session.build === 'V2' ? 2 : 1;
        if (cur.gen !== want) problems.push(`${where}: ${cur.label} is gen=${cur.gen} in a ${session.build} session (file name and build disagree)`);
      }
      continue;
    }
    if (e.pid !== null && cur.pid !== null && e.pid !== cur.pid) {
      throw new MalformedInput(`${where}: event from process ${e.pid} on a board mounted by process ${cur.pid} (two logs mixed?)`);
    }
    if (e.t < cur.lastMs) throw new MalformedInput(`${where}: t went backwards (${e.t} < ${cur.lastMs}) within one board`);
    if (cur.cleared) throw new MalformedInput(`${where}: ${e.type} after ${cur.label}'s clear, before any new board_mount`);
    if (cur.restartRequested) throw new MalformedInput(`${where}: ${e.type} after a restart, before the re-dealt board_mount`);
    cur.lastMs = e.t;
    if (cur.hearts === 0 && (e.type === 'removal' || e.type === 'blocked')) {
      if (cur.tutorial) problems.push(`${where}: a tap on tutorial ${cur.label} after its hearts reached 0 (tutorials re-deal; no continue exists)`);
      cur.continues += 1; // rewarded continue: GameScreen.onContinueWithAd sets hearts to 1, unlogged
      cur.hearts = 1;
    }
    switch (e.type) {
      case 'removal':
        cur.removals += 1;
        if (cur.firstRemovalMs === null) cur.firstRemovalMs = e.t;
        break;
      case 'blocked':
        cur.blocked += 1;
        if (cur.lessonAt !== null && e.charged) cur.blockedAfterLesson += 1;
        if (e.charged) {
          cur.charged += 1;
          cur.hearts -= 1;
          if (cur.hearts === 0) cur.losses += 1;
          if (e.graceOrAssist !== 'none') problems.push(`${where}: a charged blocked tap marked ${e.graceOrAssist}`);
        } else if (e.graceOrAssist === 'grace') {
          cur.freeGrace += 1;
          if (cur.board !== 'T2') problems.push(`${where}: tutorial grace on ${cur.label} (only T2 has it)`);
          if (cur.lessonAt === null) cur.lessonAt = e.t;
        } else if (e.graceOrAssist === 'assist') {
          cur.freeAssist += 1;
          if (cur.tutorial) problems.push(`${where}: assist on tutorial ${cur.label}`);
          if (cur.removals !== 0) problems.push(`${where}: assist after a removal on ${cur.label} (W1-06 assists only before the first removal)`);
        } else {
          cur.freeRepeat += 1;
        }
        break;
      case 'stall_hint':
        cur.stallHints += 1;
        break;
      case 'clear':
        cur.cleared = true;
        cur.clearMs = e.t;
        if (e.heartsLeft !== cur.hearts) {
          problems.push(`${where}: ${cur.label} clear says ${e.heartsLeft} hearts left; the log's taps give ${cur.hearts}`);
        }
        break;
      case 'restart':
        if (cur.hearts !== 0) problems.push(`${where}: restart on ${cur.label} with ${cur.hearts} hearts left (Retry exists only on the lose panel)`);
        cur.restartRequested = true;
        break;
      default:
        break;
    }
  }
  if (cur) close(cur, null);
  for (const a of attempts) {
    if (a.cleared ? a.removals !== a.arrows : a.removals >= a.arrows) {
      problems.push(`${file}:${a.mountLine}: ${a.label} removals ${a.removals} vs arrowCount ${a.arrows} (${a.cleared ? 'cleared' : 'not cleared'})`);
    }
  }
  return { attempts, problems };

  function close(a, next) {
    if (a.restartRequested) {
      if (!next || next.board !== a.board) {
        problems.push(`${file}:${next ? next.line : a.mountLine}: a restart of ${a.label} was not followed by the same board's mount`);
      }
      a.end = a.tutorial ? 're-dealt' : 'retry';
    } else if (next) {
      a.end = 'left';
    } else {
      a.end = 'log ends';
    }
  }
}

/** Plain-language outcome for one attempt. */
export function outcomeOf(a) {
  const cont = a.continues > 0 ? ` after ${a.continues} continue${a.continues > 1 ? 's' : ''} (inferred)` : '';
  if (a.cleared) return `cleared${cont}`;
  if (a.hearts === 0) {
    const tail = { 're-dealt': 'tutorial re-dealt', retry: 'Retry', left: 'left the board', 'log ends': 'log ends' }[a.end];
    return `lost all hearts${cont} → ${tail}`;
  }
  return a.end === 'left' ? `left the board${cont} (not cleared)` : `not cleared${cont} (log ends)`;
}

export function reconciliationOf(a) {
  if (a.cleared) return a.removals === a.arrows ? `${a.removals}/${a.arrows} ok` : `MISMATCH ${a.removals}/${a.arrows}`;
  return a.removals < a.arrows ? `${a.removals}/${a.arrows} (not cleared)` : `MISMATCH ${a.removals}/${a.arrows}`;
}

/** Median of a non-empty numeric list (mean of the two middle values when n is even). */
export function median(values) {
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const sec = (ms) => (ms === null ? '—' : (ms / 1000).toFixed(1));
const num = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const levelOrder = (label) => (label === 'T1' ? -2 : label === 'T2' ? -1 : Number(label.slice(1)));

/** Reads, parses and checks every session file. Throws MalformedInput. */
export function loadSessions(paths, read = (p) => readFileSync(p, 'utf8')) {
  const sessions = paths.map((path) => {
    const name = parseSessionName(path);
    const file = basename(path);
    const events = parseFtueLines(read(path), file);
    const { attempts, problems } = buildAttempts(events, { ...name, file });
    const warnings = [];
    if (events[0].board !== 'T1') {
      warnings.push(`${file}: the first board is ${boardLabel(events[0].board)}, not T1 — not a fresh install with the W1 flags on`);
    }
    return { ...name, file, events, attempts, problems, warnings };
  });
  const seen = new Map();
  for (const s of sessions) {
    const key = `${s.participant}-${s.order}`;
    if (seen.has(key)) throw new MalformedInput(`two files for ${s.participant} session ${s.order}: ${seen.get(key)} and ${s.file}`);
    seen.set(key, s.file);
  }
  for (const s of sessions) {
    if (s.order === 2) {
      const first = sessions.find((o) => o.participant === s.participant && o.order === 1);
      if (!first) throw new MalformedInput(`${s.file}: session 2 without a session 1 for ${s.participant}`);
      if (first.build === s.build) throw new MalformedInput(`${s.file}: ${s.participant} played ${s.build} twice`);
    }
  }
  sessions.sort((x, y) => (x.participant === y.participant ? x.order - y.order
    : x.participant.localeCompare(y.participant, 'en', { numeric: true })));
  return sessions;
}

/** Per participant-session and board: every attempt at that board pooled. */
function perBoard(session) {
  const map = new Map();
  for (const a of session.attempts) {
    const row = map.get(a.label) ?? { label: a.label, attempts: 0, taps: 0, blocked: 0, charged: 0, losses: 0, cleared: false, clearMs: null, arrows: a.arrows, shape: a.shape };
    row.attempts += 1;
    row.taps += a.removals + a.blocked;
    row.blocked += a.blocked;
    row.charged += a.charged;
    row.losses += a.losses;
    if (a.cleared && !row.cleared) { row.cleared = true; row.clearMs = a.clearMs; }
    map.set(a.label, row);
  }
  return map;
}

function summaryTable(sessions, title) {
  const out = [`### ${title}`, '',
    'n = participants who reached the board. "Clean clear" = cleared without ever losing all hearts on that level. Taps, blocked taps and hearts lost pool every attempt at the level. Time to clear is the clearing attempt only, over the n that cleared. Median and max only; no percentiles.', '',
    '| build | board | n reached | n cleared | n clean clear | taps median / max | blocked median / max | hearts lost median / max | time to clear (s) median / max (n) |',
    '|---|---|---:|---:|---:|---|---|---|---|'];
  const groups = new Map();
  for (const s of sessions) {
    for (const row of perBoard(s).values()) {
      const key = `${s.build}|${row.label}`;
      if (!groups.has(key)) groups.set(key, { build: s.build, label: row.label, rows: [] });
      groups.get(key).rows.push(row);
    }
  }
  const keys = [...groups.values()].sort((x, y) => x.build.localeCompare(y.build) || levelOrder(x.label) - levelOrder(y.label));
  if (keys.length === 0) out.push('| — | — | 0 | | | | | | |');
  for (const g of keys) {
    const r = g.rows;
    const mm = (xs) => (xs.length ? `${num(median(xs))} / ${num(Math.max(...xs))}` : '—');
    const clears = r.filter((x) => x.cleared).map((x) => x.clearMs / 1000);
    out.push(`| ${g.build} | ${g.label} | ${r.length} | ${r.filter((x) => x.cleared).length} | ${r.filter((x) => x.cleared && x.losses === 0).length} | ${mm(r.map((x) => x.taps))} | ${mm(r.map((x) => x.blocked))} | ${mm(r.map((x) => x.charged))} | ${clears.length ? `${num(median(clears))} / ${num(Math.max(...clears))} (${clears.length})` : '— (0)'} |`);
  }
  return out.join('\n');
}

/** Renders the doc's tables (f), the pass-rule inputs (e), the checks, and the raw-log appendix (g). */
export function renderMarkdown(sessions, { raw = true } = {}) {
  const md = [];
  md.push('<!-- generated by scripts/analysis/ftue-playtest-tables.mjs; do not edit by hand -->', '');
  md.push(`Sessions: ${sessions.length} (${sessions.map((s) => s.file).join(', ')}).`, '');
  md.push('### Per participant and board attempt', '',
    'One row per board mount. A Retry or a tutorial re-deal starts a new attempt. taps = removals + blocked. blocked = all blocked taps (charged / free: grace, assist, repeat). hearts lost = charged blocked taps. Times are seconds since that board mounted.', '',
    '| participant | session | build | # | board | shape | arrowCount | gen | taps | blocked (charged / grace, assist, repeat) | removals | hearts lost | first removal (s) | time to clear (s) | outcome | removals vs arrowCount |',
    '|---|---:|---|---:|---|---|---:|---:|---:|---|---:|---:|---:|---:|---|---|');
  for (const s of sessions) {
    for (const a of s.attempts) {
      md.push(`| ${s.participant} | ${s.order} | ${s.build} | ${a.n} | ${a.label} | ${a.shape || '(tutorial)'} | ${a.arrows} | ${a.gen} | ${a.removals + a.blocked} | ${a.blocked} (${a.charged} / ${a.freeGrace}, ${a.freeAssist}, ${a.freeRepeat}) | ${a.removals} | ${a.charged} | ${sec(a.firstRemovalMs)} | ${sec(a.clearMs)} | ${outcomeOf(a)} | ${reconciliationOf(a)} |`);
    }
  }
  md.push('', summaryTable(sessions, 'Summary: all sessions'), '');
  md.push(summaryTable(sessions.filter((s) => s.order === 1), 'Summary: first session only (true first-time play)'), '');

  md.push('### Pass-rule inputs', '');
  for (const build of ['V2', 'V1']) {
    for (const [title, set] of [['first session only', sessions.filter((s) => s.order === 1)], ['all sessions', sessions]]) {
      const own = set.filter((s) => s.build === build);
      if (own.length === 0) continue;
      const reached = own.filter((s) => s.attempts.some((a) => a.label === 'L1'));
      const clean = reached.filter((s) => { const r = perBoard(s).get('L1'); return r.cleared && r.losses === 0; });
      md.push(`- **${build}, ${title}:** ${clean.length} of ${own.length} sessions cleared level 1 without losing all hearts (${reached.length} reached level 1)${clean.length ? `: ${clean.map((s) => `${s.participant}-${s.order}`).join(', ')}` : ''}.`);
    }
  }
  const tooEasy = sessions.filter((s) => {
    const b = perBoard(s);
    return ['L1', 'L2', 'L3', 'L4', 'L5'].every((l) => b.get(l)?.cleared) && ['L1', 'L2', 'L3', 'L4', 'L5'].every((l) => b.get(l).blocked === 0);
  });
  md.push(`- **Too-easy signal** (cleared levels 1–5 with zero blocked taps on them, any build): ${tooEasy.length ? tooEasy.map((s) => `${s.participant}-${s.order}-${s.build}`).join(', ') : 'none'}.`);
  md.push(`- Sessions that cleared levels 1–5 at all: ${sessions.filter((s) => { const b = perBoard(s); return ['L1', 'L2', 'L3', 'L4', 'L5'].every((l) => b.get(l)?.cleared); }).map((s) => `${s.participant}-${s.order}-${s.build}`).join(', ') || 'none'}.`, '');

  md.push('### For W1-09 (record in its own doc): T2 blocked taps after the lesson line', '',
    'Charged blocked taps on T2 after the free grace tap that shows "Blocked. Clear what\'s in its way." in the same deal (a charged tap is a different arrow; a repeat on the same arrow is free).', '',
    '| participant | session | build | T2 attempt | lesson shown | charged blocked taps after it |', '|---|---:|---|---:|---|---:|');
  for (const s of sessions) {
    for (const a of s.attempts.filter((x) => x.board === 'T2')) {
      md.push(`| ${s.participant} | ${s.order} | ${s.build} | ${a.n} | ${a.lessonAt === null ? 'no' : `yes, at ${sec(a.lessonAt)} s`} | ${a.lessonAt === null ? '—' : a.blockedAfterLesson} |`);
    }
  }
  md.push('');

  md.push('### Checks', '');
  const problems = sessions.flatMap((s) => s.problems);
  const warnings = sessions.flatMap((s) => s.warnings);
  const stall = sessions.reduce((n, s) => n + s.attempts.reduce((m, a) => m + a.stallHints, 0), 0);
  md.push(`- Integrity failures: ${problems.length ? '' : 'none.'}`);
  for (const p of problems) md.push(`  - **FAIL** ${p}`);
  md.push(`- Warnings: ${warnings.length ? '' : 'none.'}`);
  for (const w of warnings) md.push(`  - ${w}`);
  md.push(`- [ftue] lines read: ${sessions.reduce((n, s) => n + s.events.length, 0)}; stall_hint lines: ${stall}.`);
  md.push('- Not in the log, so not in these tables: taps on empty cells, pans and pinches, 💡 hint use, ads shown, menu visits, time spent between boards. A rewarded continue is inferred, not logged.', '');

  if (raw) {
    md.push('### Raw [ftue] lines', '');
    for (const s of sessions) {
      md.push(`#### ${s.file}`, '', '```', ...s.events.map((e) => e.raw), '```', '');
    }
  }
  return { markdown: md.join('\n'), problems };
}

function main(argv) {
  const files = [];
  let out = null;
  let raw = true;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') { out = argv[++i]; if (!out) return usage(); }
    else if (argv[i] === '--no-raw') raw = false;
    else if (argv[i].startsWith('--')) return usage();
    else files.push(argv[i]);
  }
  if (files.length === 0) return usage();
  let sessions;
  try {
    sessions = loadSessions(files);
  } catch (e) {
    if (e instanceof MalformedInput || e.code === 'ENOENT') {
      process.stderr.write(`MALFORMED: ${e.message}\n`);
      return 1;
    }
    throw e;
  }
  const { markdown, problems } = renderMarkdown(sessions, { raw });
  if (out) writeFileSync(out, `${markdown}\n`); else process.stdout.write(`${markdown}\n`);
  if (problems.length) {
    process.stderr.write(`INTEGRITY FAILED (${problems.length}):\n${problems.map((p) => `  ${p}`).join('\n')}\n`);
    return 3;
  }
  return 0;
}

function usage() {
  process.stderr.write('usage: node scripts/analysis/ftue-playtest-tables.mjs [--out tables.md] [--no-raw] <P1-1-V2.txt> ...\n');
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = main(process.argv.slice(2));
