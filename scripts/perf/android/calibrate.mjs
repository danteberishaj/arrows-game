#!/usr/bin/env node
// Calibration runs behind docs/perf-capture-calibration.md (P-02 Stages C and D).
// Every number in that doc names the subcommand that produced it.
//
//   node scripts/perf/android/calibrate.mjs recorder --apk <perf.apk> [--n 5] --out <dir>
//   node scripts/perf/android/calibrate.mjs idle     --apk <perf.apk> --out <dir>
//   node scripts/perf/android/calibrate.mjs blocked-pairs --apk <apk> --set A|B|B0|C --motion-scale 0|1 [--n 10] [--cell row,col] --out <dir>
//   node scripts/perf/android/calibrate.mjs menu-pairs --apk <menu.apk> --motion-scale 0|1 [--n 10] --out <dir>
//   node scripts/perf/android/calibrate.mjs exit-recordings --apk <apk> --set A|B|B0|C --motion-scale 0|1 [--n 10] --out <dir>
//
// It drives the device only through capture.mjs's building blocks (device.mjs) and measures with
// pixel-diff.mjs. Output: <dir>/<subcommand>.json with raw per-sample values.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveAndroidSdkRoot } from './build-uiautomator.mjs';
import { frameStats, probeFrameTimes, splitFrames, stepContext } from './capture.mjs';
import {
  adb,
  adbBinary,
  applyMotionScale,
  assertAppReducedMotionMatches,
  delay,
  deviceIdentity,
  dumpUiXml,
  finishScreenRecord,
  gitMetadata,
  halfSize,
  parseMotionScale,
  physicalDisplaySize,
  resolveActivity,
  sha256File,
  startScreenRecord,
  tryCapture,
} from './device.mjs';
import { decodePng, diffImages, exitMotion, resolveRegion } from './pixel-diff.mjs';

export const BLOCKER_FLASH_MS = 650; // src/ui/feedbackCurves.ts BLOCKER_FLASH_MS
const MAGENTA_MIN_PIXELS = 40; // OWNER-PICKED STARTING VALUE: onset = first frame with this many flash pixels
export const MID_PHASE_DELAY_S = 0.15; // OWNER-PICKED STARTING VALUE: tap-up -> mid-phase screencap
export const MENU_PAIR_GAP_S = 0.5; // OWNER-PICKED STARTING VALUE: idle menu pre -> post screencap
export const EXIT_SECOND_FRAME_OFFSET_MS = 60; // OWNER-PICKED STARTING VALUE: first trail frame -> second
export const EXIT_FOOTPRINT_DILATE_PX = 2; // OWNER-PICKED STARTING VALUE: footprint dilation, recording px
export const SAMPLE_SETTLE_MS = 2500; // OWNER-PICKED STARTING VALUE: launch -> first frame of a sample

function log(message) {
  process.stderr.write(`[calibrate] ${message}\n`);
}

/** The blocked cell the Stage E gate taps (benchmark.mjs runAssertRendered). Other cells are held-out checks. */
export const DEFAULT_BLOCKED_CELL = [35, 19];

function parseCell(text) {
  const match = /^(\d+),(\d+)$/.exec(text ?? '');
  if (!match) throw new Error(`--cell <row,col> expects two non-negative integers, got ${text}`);
  return [Number(match[1]), Number(match[2])];
}

export function parseCalibrateArgs(argv) {
  const [command, ...rest] = argv;
  const options = {
    command,
    n: null,
    apk: null,
    set: null,
    motionScale: null,
    out: null,
    serial: 'emulator-5556',
    cell: DEFAULT_BLOCKED_CELL,
    cellExplicit: false,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const value = () => {
      const next = rest[++index];
      if (next === undefined) throw new Error(`${arg} requires a value`);
      return next;
    };
    if (arg === '--apk') options.apk = resolve(value());
    else if (arg === '--n') options.n = Number(value());
    else if (arg === '--set') options.set = value();
    else if (arg === '--motion-scale') options.motionScale = parseMotionScale(value());
    else if (arg === '--out') options.out = resolve(value());
    else if (arg === '--serial') options.serial = value();
    else if (arg === '--cell') {
      options.cell = parseCell(rest[++index]);
      options.cellExplicit = true;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.out) throw new Error('--out <dir> is required');
  return options;
}

/** Flash-magenta test used for the recorder table (#E4327D family on an H.264 frame). */
export function isFlashMagenta(r, g, b) {
  return r > 170 && g < 120 && b > 70 && b < 180;
}

function countMagenta(image, rect) {
  let count = 0;
  for (let y = rect.top; y < rect.bottom; y += 1) {
    for (let x = rect.left; x < rect.right; x += 1) {
      const i = (y * image.width + x) * 3;
      if (isFlashMagenta(image.data[i], image.data[i + 1], image.data[i + 2])) count += 1;
    }
  }
  return count;
}

/** Frames whose pts falls inside [onset, onset + windowMs), and the periods between them. */
export function windowStats(times, onsetIndex, windowMs) {
  const start = times[onsetIndex];
  const inside = times.filter((t) => t >= start && t < start + windowMs / 1000);
  return { onsetS: start, framesInWindow: inside.length, ...frameStats(inside) };
}

class Session {
  constructor(options) {
    this.options = options;
    this.adb = join(resolveAndroidSdkRoot(), 'platform-tools', 'adb');
    this.serial = options.serial;
    this.identity = deviceIdentity(this.adb, this.serial);
    if (options.apk) {
      log(`installing ${options.apk}`);
      adb(this.adb, this.serial, ['install', '-r', '-t', options.apk], { timeout: 180_000 });
      this.apk = { path: options.apk, sha256: sha256File(options.apk) };
    }
    this.activity = resolveActivity(this.adb, this.serial);
    this.display = physicalDisplaySize(this.adb, this.serial);
  }

  /** Scales + force-stop + launch + read-back for EVERY sample (fresh app process, full hearts). */
  launch(scale) {
    const motion = applyMotionScale(this.adb, this.serial, this.activity, scale);
    assertAppReducedMotionMatches(motion.readBack, motion.appReducedMotion);
    delay(SAMPLE_SETTLE_MS);
    return { ...motion.environment, appReducedMotionSource: motion.appReducedMotionSource };
  }

  shell(command) {
    return adb(this.adb, this.serial, ['shell', command], { timeout: 60_000 });
  }

  pull(remote, local) {
    writeFileSync(local, adbBinary(this.adb, this.serial, ['cat', remote]));
    tryCapture(this.adb, ['-s', this.serial, 'shell', 'rm', '-f', remote]);
  }

  header() {
    return {
      createdAt: new Date().toISOString(),
      git: gitMetadata(),
      device: this.identity,
      apk: this.apk ?? null,
      display: this.display,
    };
  }
}

/** Header strip bottom: the lowest "LEVEL n" / "n left" text node (they change on every removal). */
export function headerBottomFromXml(xml) {
  let bottom = 0;
  for (const tag of xml?.match(/<node\b[^>]*>/g) ?? []) {
    if (!/text="(LEVEL \d+|[^"]*\d+ left)"/.test(tag)) continue;
    const m = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (m) bottom = Math.max(bottom, Number(m[4]));
  }
  return bottom;
}

async function boardGeometry(session) {
  const context = await stepContext(session.adb, session.serial);
  const xml = dumpUiXml(session.adb, session.serial);
  const headerBottom = headerBottomFromXml(xml);
  return { context, headerBottom };
}

// ---------------------------------------------------------------- C2: recorder

async function recorder(session, options) {
  const n = options.n ?? 5; // OWNER-PICKED STARTING VALUE (brief)
  const bench = await import('./benchmark.mjs');
  const { runStep } = await import('./capture.mjs');
  const samples = [];
  for (let i = 1; i <= n; i += 1) {
    const motion = session.launch(1);
    const { context, headerBottom } = await boardGeometry(session);
    const size = halfSize(session.display);
    const remote = `/sdcard/calibrate-recorder-${i}.mp4`;
    const recording = startScreenRecord(session.adb, session.serial, remote, { timeLimitS: 3, size });
    delay(800);
    const step = await runStep(context, 'blocked');
    const mp4 = join(options.out, `recorder-${i}.mp4`);
    await finishScreenRecord(session.adb, session.serial, recording, mp4);
    const times = probeFrameTimes(mp4);
    const framesDir = join(options.out, `recorder-${i}-frames`);
    splitFrames(mp4, framesDir);
    const files = readdirSync(framesDir).filter((f) => f.endsWith('.png')).sort();
    if (files.length !== times.length) throw new Error(`frames ${files.length} != pts ${times.length}`);
    const scale = Number(size.split('x')[0]) / session.display.width;
    const magenta = [];
    let rect = null;
    for (const file of files) {
      const image = await decodePng(join(framesDir, file));
      rect ??= resolveRegion('board', image, { board: context.bounds, headerBottom, scale });
      magenta.push(countMagenta(image, rect));
    }
    rmSync(framesDir, { recursive: true, force: true });
    const onsetIndex = magenta.findIndex((count) => count >= MAGENTA_MIN_PIXELS);
    if (onsetIndex < 0) throw new Error(`recording ${i}: no flash frame found`);
    const stats = windowStats(times, onsetIndex, BLOCKER_FLASH_MS);
    const sample = {
      recording: mp4,
      size,
      motion,
      step,
      boardRect: rect,
      totalFrames: times.length,
      frameTimesS: times,
      magentaPerFrame: magenta,
      ...stats,
      expectedFramesAtMedianPeriod: stats.medianPeriodMs ? BLOCKER_FLASH_MS / stats.medianPeriodMs : null,
    };
    log(`recorder ${i}: ${stats.framesInWindow} frames in the flash window, median period ${stats.medianPeriodMs} ms`);
    samples.push(sample);
  }
  return { subcommand: 'recorder', blockerFlashMs: BLOCKER_FLASH_MS, magentaMinPixels: MAGENTA_MIN_PIXELS, samples };
}

async function idle(session, options) {
  const motion = session.launch(1);
  const size = halfSize(session.display);
  const remote = '/sdcard/calibrate-idle.mp4';
  const recording = startScreenRecord(session.adb, session.serial, remote, { timeLimitS: 2, size });
  const mp4 = join(options.out, 'idle-board-2s.mp4');
  await finishScreenRecord(session.adb, session.serial, recording, mp4);
  const times = probeFrameTimes(mp4);
  return { subcommand: 'idle', seconds: 2, motion, recording: mp4, frameTimesS: times, ...frameStats(times) };
}

// ---------------------------------------------------------------- D: screencap pairs

async function blockedPairs(session, options) {
  const n = options.n ?? 10; // OWNER-PICKED STARTING VALUE (brief)
  const bench = await import('./benchmark.mjs');
  const plan = bench.createSingleLevelPlan();
  const samples = [];
  for (let i = 1; i <= n; i += 1) {
    const motion = session.launch(options.motionScale);
    const { context, headerBottom } = await boardGeometry(session);
    const [row, col] = options.cell;
    const point = bench.cellCenter(context.bounds, row, col, plan.rows, plan.cols);
    const stem = `blocked-${options.set}-s${options.motionScale}${options.cellExplicit ? `-cell${row}-${col}` : ''}-${i}`;
    const prePath = join(options.out, `${stem}-pre.png`);
    const midPath = join(options.out, `${stem}-mid.png`);
    const { timingMs, board, screen } = await probeBlockedPair(session.adb, session.serial, {
      bounds: context.bounds,
      headerBottom,
      point: options.set === 'A' ? null : point, // set A: no input at all
      prePath,
      midPath,
    });
    samples.push({
      i,
      motion,
      boardBounds: context.bounds,
      headerBottom,
      timingMs,
      boardFraction: board.fraction,
      boardChanged: board.changed,
      boardTotal: board.total,
      screenFraction: screen.fraction,
      screenChanged: screen.changed,
      pre: prePath,
      mid: midPath,
    });
    log(`blocked set ${options.set} scale ${options.motionScale} #${i}: board ${board.changed}/${board.total}`);
    // Keep the first and last pair as evidence; the numbers are in the JSON.
    if (i !== 1 && i !== n) {
      rmSync(prePath);
      rmSync(midPath);
    }
  }
  return { subcommand: 'blocked-pairs', set: options.set, motionScale: options.motionScale, cell: options.cell, midPhaseDelayS: MID_PHASE_DELAY_S, samples };
}

/**
 * One blocked-phase screencap pair (Stage D calibration and Stage E gate share it).
 * `input tap` has a 0 ms hold and returns in ~20 ms. ArrowsWorkload's JVM needs ~0.9 s to exit after
 * its UP, which would push the mid-phase frame past the 650 ms flash. `point: null` means no input.
 */
export async function probeBlockedPair(adbExecutable, serial, { bounds, headerBottom, point, prePath, midPath }) {
  const pre = '/data/local/tmp/render-probe-pre.png';
  const mid = '/data/local/tmp/render-probe-mid.png';
  const input = point ? `input tap ${point.x} ${point.y}` : 'true';
  const stamps = adb(adbExecutable, serial, ['shell',
    `t0=$(date +%s%N); screencap -p ${pre}; t1=$(date +%s%N); ${input}; t2=$(date +%s%N); ` +
    `sleep ${MID_PHASE_DELAY_S}; t3=$(date +%s%N); screencap -p ${mid}; t4=$(date +%s%N); ` +
    'echo $t0 $t1 $t2 $t3 $t4',
  ], { timeout: 60_000 }).split(/\s+/).map(Number);
  const timingMs = {
    preScreencap: (stamps[1] - stamps[0]) / 1e6,
    input: (stamps[2] - stamps[1]) / 1e6,
    inputEndToMidScreencapStart: (stamps[3] - stamps[2]) / 1e6,
    midScreencap: (stamps[4] - stamps[3]) / 1e6,
  };
  for (const [remote, local] of [[pre, prePath], [mid, midPath]]) {
    writeFileSync(local, adbBinary(adbExecutable, serial, ['cat', remote]));
    tryCapture(adbExecutable, ['-s', serial, 'shell', 'rm', '-f', remote]);
  }
  const a = await decodePng(prePath);
  const b = await decodePng(midPath);
  return {
    timingMs,
    board: diffImages(a, b, { rect: resolveRegion('board', a, { board: bounds, headerBottom }) }),
    screen: diffImages(a, b, { rect: resolveRegion('screen', a) }),
  };
}

/**
 * One exit recording: 2 s screenrecord at half size, `input tap` on `point` 800 ms in (null = no
 * input), frames split, pixel-diff exitMotion over the board region.
 */
export async function probeExitRecording(adbExecutable, serial, { display, bounds, headerBottom, point, direction, mp4, framesDir, trailCountFloor = 0 }) {
  const size = halfSize(display);
  const scale = Number(size.split('x')[0]) / display.width;
  const recording = startScreenRecord(adbExecutable, serial, `/sdcard/render-probe-exit.mp4`, { timeLimitS: 2, size });
  delay(800);
  if (point) adb(adbExecutable, serial, ['shell', 'input', 'tap', String(point.x), String(point.y)]);
  await finishScreenRecord(adbExecutable, serial, recording, mp4);
  const times = probeFrameTimes(mp4);
  splitFrames(mp4, framesDir);
  const analysis = await analyseExitRecording(framesDir, times, {
    rectFor: (image) => resolveRegion('board', image, { board: bounds, headerBottom, scale }),
    direction,
    trailCountFloor,
  });
  rmSync(framesDir, { recursive: true, force: true });
  return { recording: mp4, size, frameTimesS: times, ...analysis };
}

function boundsOf(xml, predicate) {
  const tag = xml?.match(/<node\b[^>]*>/g)?.find(predicate);
  const m = tag?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  return m ? { left: +m[1], top: +m[2], right: +m[3], bottom: +m[4] } : null;
}

async function menuPairs(session, options) {
  const n = options.n ?? 10; // OWNER-PICKED STARTING VALUE (brief)
  // The Play pill's resting bounds come from a scale-0 dump (at scale 1 it breathes and
  // uiautomator cannot dump). Its breath is scale 1..1.03 (HomeScreen.tsx), so the mask grows
  // by 3% of each side plus 8 px antialiasing (OWNER-PICKED STARTING VALUE).
  session.launch(0);
  const xml = dumpUiXml(session.adb, session.serial);
  // The pill is the clickable Pressable (content-desc "Play"), not its inner Text node.
  const pill = boundsOf(xml, (tag) => /content-desc="Play"/.test(tag) && /clickable="true"/.test(tag));
  if (!pill) throw new Error('Play pill not found in the menu dump');
  const growX = Math.ceil((pill.right - pill.left) * 0.03) + 8;
  const growY = Math.ceil((pill.bottom - pill.top) * 0.03) + 8;
  const mask = {
    x: pill.left - growX,
    y: pill.top - growY,
    w: pill.right - pill.left + 2 * growX,
    h: pill.bottom - pill.top + 2 * growY,
  };
  const samples = [];
  for (let i = 1; i <= n; i += 1) {
    const motion = session.launch(options.motionScale);
    session.shell(`screencap -p /data/local/tmp/menu-pre.png; sleep ${MENU_PAIR_GAP_S}; screencap -p /data/local/tmp/menu-post.png`);
    const prePath = join(options.out, `menu-s${options.motionScale}-${i}-pre.png`);
    const postPath = join(options.out, `menu-s${options.motionScale}-${i}-post.png`);
    session.pull('/data/local/tmp/menu-pre.png', prePath);
    session.pull('/data/local/tmp/menu-post.png', postPath);
    const a = await decodePng(prePath);
    const b = await decodePng(postPath);
    const rect = resolveRegion('screen', a);
    const unmasked = diffImages(a, b, { rect });
    const masked = diffImages(a, b, { rect, masks: [mask] });
    samples.push({
      i,
      motion,
      screenFraction: unmasked.fraction,
      screenChanged: unmasked.changed,
      screenFractionPillMasked: masked.fraction,
      screenChangedPillMasked: masked.changed,
      pre: prePath,
      post: postPath,
    });
    log(`menu scale ${options.motionScale} #${i}: ${unmasked.changed} px, masked ${masked.changed} px`);
    if (i !== 1 && i !== n) {
      rmSync(prePath);
      rmSync(postPath);
    }
  }
  return { subcommand: 'menu-pairs', motionScale: options.motionScale, gapS: MENU_PAIR_GAP_S, pill, mask, samples };
}

// ---------------------------------------------------------------- D/E: exit recordings

export const DIRECTION_NAMES = ['up', 'down', 'left', 'right']; // src/core/direction.ts enum order

/** Decodes a split recording and runs pixel-diff's exitMotion on it (board region). */
export async function analyseExitRecording(framesDir, times, { rectFor, direction, trailCountFloor = 0 }) {
  const files = readdirSync(framesDir).filter((f) => f.endsWith('.png')).sort();
  if (files.length !== times.length) throw new Error(`frames ${files.length} != pts ${times.length}`);
  const frames = [];
  for (const file of files) frames.push(await decodePng(join(framesDir, file)));
  const rect = rectFor(frames[0]);
  if (frames.length < 3) {
    // Nothing changed on screen: the recorder emitted only its first (and maybe last) frame.
    return { frames: frames.length, rect, footprintPixels: 0, first: null, second: null, displacementPx: 0, maxChangedFraction: 0, perFrame: [] };
  }
  return {
    frames: frames.length,
    rect,
    ...exitMotion(frames, times, {
      rect,
      direction,
      dilatePx: EXIT_FOOTPRINT_DILATE_PX,
      secondFrameOffsetMs: EXIT_SECOND_FRAME_OFFSET_MS,
      trailCountFloor,
    }),
  };
}

async function exitRecordings(session, options) {
  const n = options.n ?? 10; // OWNER-PICKED STARTING VALUE (brief)
  const bench = await import('./benchmark.mjs');
  const plan = bench.createSingleLevelPlan();
  const tap = plan.taps[plan.arrowCount - bench.EXIT_PHASE_STARTING_ARROW_COUNT];
  const samples = [];
  for (let i = 1; i <= n; i += 1) {
    const motion = session.launch(options.motionScale);
    const { context, headerBottom } = await boardGeometry(session);
    const point = options.set === 'A'
      ? null // set A: no input at all
      : bench.cellCenter(context.bounds, tap.row, tap.col, plan.rows, plan.cols);
    const mp4 = join(options.out, `exit-${options.set}-s${options.motionScale}-${i}.mp4`);
    const analysis = await probeExitRecording(session.adb, session.serial, {
      display: session.display,
      bounds: context.bounds,
      headerBottom,
      point,
      direction: DIRECTION_NAMES[tap.dir],
      mp4,
      framesDir: join(options.out, `exit-${options.set}-s${options.motionScale}-${i}-frames`),
    });
    const step = point ? { injector: 'input tap', point } : { step: 'none' };
    samples.push({ i, motion, step, direction: DIRECTION_NAMES[tap.dir], ...analysis });
    log(`exit set ${options.set} scale ${options.motionScale} #${i}: frames ${analysis.frames}, max changed ${analysis.maxChangedFraction}, trail ${analysis.first?.trailPixels ?? 0} px, displacement ${analysis.displacementPx} px`);
    if (i !== 1 && i !== n) rmSync(mp4);
  }
  return { subcommand: 'exit-recordings', set: options.set, motionScale: options.motionScale, secondFrameOffsetMs: EXIT_SECOND_FRAME_OFFSET_MS, footprintDilatePx: EXIT_FOOTPRINT_DILATE_PX, samples };
}

/** `<subcommand>[-<set>][-s<scale>][-cell<row>-<col>]`: a held-out cell never overwrites the gate cell's JSON. */
export function calibrationOutputName(options) {
  return [
    options.command,
    options.set,
    options.motionScale === null ? null : `s${options.motionScale}`,
    options.cellExplicit ? `cell${options.cell[0]}-${options.cell[1]}` : null,
  ]
    .filter((part) => part !== null && part !== undefined)
    .join('-');
}

async function main() {
  const options = parseCalibrateArgs(process.argv.slice(2));
  mkdirSync(options.out, { recursive: true });
  const session = new Session(options);
  const commands = {
    recorder,
    idle,
    'blocked-pairs': blockedPairs,
    'menu-pairs': menuPairs,
    'exit-recordings': exitRecordings,
  };
  const run = commands[options.command];
  if (!run) throw new Error(`unknown subcommand ${options.command} (${Object.keys(commands).join(', ')})`);
  if (['blocked-pairs', 'exit-recordings'].includes(options.command)) {
    if (!['A', 'B', 'B0', 'C'].includes(options.set)) throw new Error('--set A|B|B0|C is required');
  }
  if (['blocked-pairs', 'menu-pairs', 'exit-recordings'].includes(options.command) && options.motionScale === null) {
    throw new Error('--motion-scale is required');
  }
  const result = { ...session.header(), argv: process.argv.slice(2), ...(await run(session, options)) };
  const path = join(options.out, `${calibrationOutputName(options)}.json`);
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
  log(`wrote ${path}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
