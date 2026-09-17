#!/usr/bin/env node
// Capture instrument for any installed APK (P-02 Stage C).
//
//   npm run capture:android -- --motion-scale <0|1> (--shot <label> | --record <label> --seconds <n>)
//     [--apk path] [--wm-size WxH] [--wm-density dpi] [--frames] [--record-size WxH]
//     [--step blocked|exit|won|lost] [--settle-ms n] [--build-env KEY=VALUE ...] [--serial s]
//
// It observes: it sets the three motion scales, force-stops, launches, reads everything back and
// takes a screencap or a screenrecord. It taps only for a scripted --step (PERF builds, level 3827).
// Every artifact lands in artifacts/captures/<label>/ with a manifest.json beside it.
// A capture never produces perf numbers.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildInputDriver, resolveAndroidSdkRoot } from './build-uiautomator.mjs';
import {
  APPLICATION_ID,
  PROJECT_ROOT,
  adb,
  applyMotionScale,
  assertAppReducedMotionMatches,
  delay,
  deviceIdentity,
  finishScreenRecord,
  gitMetadata,
  halfSize,
  parseMotionScale,
  physicalDisplaySize,
  readWm,
  resolveActivity,
  screencapPng,
  sha256File,
  startScreenRecord,
  tryCapture,
} from './device.mjs';

const STEPS = new Set(['blocked', 'exit', 'won', 'lost']);
const DEFAULT_SETTLE_MS = 1500; // OWNER-PICKED STARTING VALUE: launch -> first observation
const RECORD_LEAD_IN_MS = 800; // OWNER-PICKED STARTING VALUE: recorder start-up before a step
const CALIBRATION_DOC = join(PROJECT_ROOT, 'docs/perf-capture-calibration.md');

function log(message) {
  process.stderr.write(`[capture:android] ${message}\n`);
}

export function parseCaptureArgs(argv) {
  const options = {
    serial: 'emulator-5556',
    apk: null,
    motionScale: null,
    wmSize: null,
    wmDensity: null,
    kind: null,
    label: null,
    seconds: null,
    frames: false,
    recordSize: null,
    step: null,
    settleMs: DEFAULT_SETTLE_MS,
    buildEnv: {},
    outRoot: join(PROJECT_ROOT, 'artifacts/captures'),
  };
  let shot = null;
  let record = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      const next = argv[++index];
      if (next === undefined) throw new Error(`${arg} requires a value`);
      return next;
    };
    if (arg === '--') continue;
    else if (arg === '--frames') options.frames = true;
    else if (arg === '--serial') options.serial = value();
    else if (arg === '--apk') options.apk = resolve(value());
    else if (arg === '--motion-scale') options.motionScale = parseMotionScale(value());
    else if (arg === '--wm-size') options.wmSize = value();
    else if (arg === '--wm-density') options.wmDensity = value();
    else if (arg === '--shot') shot = value();
    else if (arg === '--record') record = value();
    else if (arg === '--seconds') options.seconds = Number(value());
    else if (arg === '--record-size') options.recordSize = value();
    else if (arg === '--step') options.step = value();
    else if (arg === '--settle-ms') options.settleMs = Number(value());
    else if (arg === '--out-root') options.outRoot = resolve(value());
    else if (arg === '--build-env') {
      const entry = value();
      const match = entry.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      if (!match) throw new Error(`--build-env must be KEY=VALUE (got ${JSON.stringify(entry)})`);
      options.buildEnv[match[1]] = match[2];
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.motionScale === null) {
    throw new Error('--motion-scale is required (0 or 1): a capture never inherits the device state');
  }
  if ((shot === null) === (record === null)) {
    throw new Error('give exactly one of --shot <label> or --record <label>');
  }
  options.kind = shot !== null ? 'shot' : 'record';
  options.label = shot ?? record;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(options.label)) {
    throw new Error(`label must be a plain directory name (got ${JSON.stringify(options.label)})`);
  }
  if (options.kind === 'record') {
    if (!Number.isInteger(options.seconds) || options.seconds < 1 || options.seconds > 180) {
      throw new Error('--record needs --seconds <integer 1..180>');
    }
  } else if (options.frames) {
    throw new Error('--frames needs --record');
  }
  if (options.wmSize !== null && !/^\d+x\d+$/.test(options.wmSize)) {
    throw new Error(`--wm-size must be WxH in px (got ${JSON.stringify(options.wmSize)})`);
  }
  if (options.recordSize !== null && !/^\d+x\d+$/.test(options.recordSize)) {
    throw new Error(`--record-size must be WxH in px (got ${JSON.stringify(options.recordSize)})`);
  }
  if (options.wmDensity !== null) {
    if (!/^\d+$/.test(options.wmDensity)) throw new Error('--wm-density must be an integer dpi');
    options.wmDensity = Number(options.wmDensity);
  }
  if (options.step !== null && !STEPS.has(options.step)) {
    throw new Error(`--step must be one of ${[...STEPS].join(', ')}`);
  }
  if (!Number.isInteger(options.settleMs) || options.settleMs < 0) throw new Error('--settle-ms must be >= 0');
  return options;
}

export function readCalibrationBlock(markdown) {
  const match = String(markdown).match(
    /<!-- capture-calibration:begin -->\s*```json\s*([\s\S]*?)```\s*<!-- capture-calibration:end -->/,
  );
  return match ? JSON.parse(match[1]) : null;
}

const round3 = (value) => Math.round(value * 1000) / 1000;

export function frameStats(ptsSeconds) {
  const periods = [];
  for (let index = 1; index < ptsSeconds.length; index += 1) {
    periods.push(round3((ptsSeconds[index] - ptsSeconds[index - 1]) * 1000));
  }
  const sorted = [...periods].sort((a, b) => a - b);
  const median = sorted.length === 0
    ? null
    : sorted.length % 2 === 1
      ? sorted[(sorted.length - 1) / 2]
      : round3((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);
  return {
    frameCount: ptsSeconds.length,
    periodCount: periods.length,
    minPeriodMs: sorted[0] ?? null,
    medianPeriodMs: median,
    maxPeriodMs: sorted.at(-1) ?? null,
  };
}

export function probeFrameTimes(mp4) {
  const output = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', mp4,
  ], { encoding: 'utf8' });
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map(Number);
}

export function splitFrames(mp4, outDir) {
  mkdirSync(outDir, { recursive: true });
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-i', mp4, '-fps_mode', 'passthrough', '-start_number', '0', join(outDir, '%05d.png'),
  ]);
}

function calibrationForManifest() {
  if (!existsSync(CALIBRATION_DOC)) return null;
  try {
    return readCalibrationBlock(readFileSync(CALIBRATION_DOC, 'utf8'));
  } catch {
    return null;
  }
}

function installedApkSha(adbExecutable, serial) {
  const path = tryCapture(adbExecutable, ['-s', serial, 'shell', 'pm', 'path', APPLICATION_ID])
    ?.split(/\r?\n/)
    .find((line) => line.startsWith('package:'))
    ?.slice('package:'.length);
  if (!path) return { path: null, sha256: null, source: 'not-installed' };
  const sum = tryCapture(adbExecutable, ['-s', serial, 'shell', 'sha256sum', path]);
  return { path, sha256: sum?.split(/\s+/)[0] ?? null, source: 'installed-package' };
}

// ---------------------------------------------------------------- scripted steps (PERF builds)

const pushedDrivers = new Set();

export async function stepContext(adbExecutable, serial) {
  const { findBoardBounds } = await import('./benchmark.mjs');
  const remoteJar = '/data/local/tmp/arrows-perf-input.jar';
  if (!pushedDrivers.has(serial)) {
    const sdkRoot = resolveAndroidSdkRoot();
    const tempRoot = mkdtempSync(join(tmpdir(), 'arrows-capture-'));
    const localJar = buildInputDriver({ sdkRoot, apiLevel: 31, outputDir: join(tempRoot, 'input-driver') });
    adb(adbExecutable, serial, ['push', localJar, remoteJar]);
    rmSync(tempRoot, { recursive: true, force: true });
    pushedDrivers.add(serial);
  }
  const context = {
    adbExecutable,
    serial,
    remoteJar,
    displayHeight: physicalDisplaySize(adbExecutable, serial).height,
  };
  context.bounds = findBoardBounds(context);
  return context;
}

/**
 * Every scripted tap goes through ArrowsWorkload (32 ms sleep between DOWN and UP;
 * measured DOWN->UP eventTime 35-40 ms, docs/perf-capture-calibration.md), below
 * PRESS_PREVIEW_DELAY_MS = 64, so no press preview is drawn.
 */
export async function runStep(context, step) {
  const bench = await import('./benchmark.mjs');
  const plan = bench.createSingleLevelPlan();
  const tap = (row, col) => {
    const point = bench.cellCenter(context.bounds, row, col, plan.rows, plan.cols);
    return bench.invokeGestureDriver(context, ['tap', String(point.x), String(point.y)]);
  };
  if (step === 'blocked') return { step, cells: [[35, 19]], timing: tap(35, 19) };
  if (step === 'exit') {
    const { row, col } = plan.taps[plan.arrowCount - bench.EXIT_PHASE_STARTING_ARROW_COUNT];
    return { step, cells: [[row, col]], timing: tap(row, col) };
  }
  if (step === 'lost') {
    const cells = [[35, 19], [31, 14], [30, 21]]; // validateWorkload's three distinct blocked arrows
    const timings = cells.map(([row, col]) => {
      const timing = tap(row, col);
      delay(400);
      return timing;
    });
    return { step, cells, timings };
  }
  // won: solve the whole board in the harness's own tap batches.
  const points = plan.taps.map(({ row, col }) => bench.cellCenter(context.bounds, row, col, plan.rows, plan.cols));
  const { chunkTapPoints } = await import('./soak-utils.mjs');
  for (const chunk of chunkTapPoints(points)) {
    bench.runTapSequence(context, chunk);
    delay(300);
  }
  return { step, taps: points.length };
}

async function waitForStepResult(context, step) {
  const bench = await import('./benchmark.mjs');
  if (step === 'won') return bench.waitForUiText(context, 'perf-next-level');
  if (step === 'lost') return bench.waitForUiText(context, 'perf-terminal-overlay');
  return null;
}

// ---------------------------------------------------------------- main

async function main() {
  const options = parseCaptureArgs(process.argv.slice(2));
  const sdkRoot = resolveAndroidSdkRoot();
  const adbExecutable = join(sdkRoot, 'platform-tools', 'adb');
  const { serial } = options;
  const outDir = join(options.outRoot, options.label);
  mkdirSync(outDir, { recursive: true });
  const manifestPath = join(outDir, 'manifest.json');
  const manifest = {
    schemaVersion: 1,
    tool: 'scripts/perf/android/capture.mjs',
    label: options.label,
    kind: options.kind,
    createdAt: new Date().toISOString(),
    argv: process.argv.slice(2),
    git: gitMetadata(),
    buildEnv: options.buildEnv,
    perfNumbers: 'none (a capture never produces perf numbers)',
  };
  const writeManifest = () => writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  let wmChanged = false;
  let failure = null;
  try {
    manifest.device = deviceIdentity(adbExecutable, serial);
    adb(adbExecutable, serial, ['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
    tryCapture(adbExecutable, ['-s', serial, 'shell', 'wm', 'dismiss-keyguard']);

    if (options.apk) {
      log(`installing ${options.apk}`);
      adb(adbExecutable, serial, ['install', '-r', '-t', options.apk], { timeout: 180_000 });
      manifest.apk = { path: options.apk, sha256: sha256File(options.apk), source: 'file', installedByCapture: true };
    } else {
      manifest.apk = { ...installedApkSha(adbExecutable, serial), installedByCapture: false };
    }

    if (options.wmSize !== null || options.wmDensity !== null) {
      wmChanged = true;
      if (options.wmSize !== null) adb(adbExecutable, serial, ['shell', 'wm', 'size', options.wmSize]);
      if (options.wmDensity !== null) adb(adbExecutable, serial, ['shell', 'wm', 'density', String(options.wmDensity)]);
    }
    const wm = readWm(adbExecutable, serial);
    manifest.wm = {
      requested: { size: options.wmSize, density: options.wmDensity },
      readBack: { ...wm, raw: undefined },
    };
    if (options.wmSize !== null && wm.overrideSize !== options.wmSize) {
      throw new Error(`wm size read back ${wm.overrideSize}, requested ${options.wmSize}`);
    }
    if (options.wmDensity !== null && wm.overrideDensity !== options.wmDensity) {
      throw new Error(`wm density read back ${wm.overrideDensity}, requested ${options.wmDensity}`);
    }

    const activity = resolveActivity(adbExecutable, serial);
    const motion = applyMotionScale(adbExecutable, serial, activity, options.motionScale);
    manifest.motion = {
      requestedMotionScale: options.motionScale,
      ...motion.environment,
      appReducedMotionSource: motion.appReducedMotionSource,
    };
    log(`motion read-back ${JSON.stringify(motion.readBack)}; app reduced motion ${JSON.stringify(motion.appReducedMotion)}`);
    assertAppReducedMotionMatches(motion.readBack, motion.appReducedMotion);

    const calibration = calibrationForManifest();
    const unmeasured = 'unmeasured: docs/perf-capture-calibration.md has no capture-calibration block';
    manifest.tapHold = calibration?.tapHold ?? unmeasured;
    manifest.recorderFramePeriod = calibration?.recorderFramePeriod ?? unmeasured;
    writeManifest();

    delay(options.settleMs);
    const context = options.step ? await stepContext(adbExecutable, serial) : null;
    if (context) manifest.boardBounds = context.bounds;

    if (options.kind === 'shot') {
      if (options.step) {
        manifest.stepResult = await runStep(context, options.step);
        await waitForStepResult(context, options.step);
      }
      const png = join(outDir, `${options.label}.png`);
      writeFileSync(png, screencapPng(adbExecutable, serial));
      manifest.artifacts = [png];
    } else {
      const size = options.recordSize ?? halfSize(physicalDisplaySize(adbExecutable, serial));
      const remote = `/sdcard/capture-${options.label}.mp4`;
      const recording = startScreenRecord(adbExecutable, serial, remote, { timeLimitS: options.seconds, size });
      if (options.step) {
        delay(RECORD_LEAD_IN_MS);
        manifest.stepResult = {
          ...(await runStep(context, options.step)),
          hostMsAfterRecorderSpawn: Date.now() - recording.startedAtMs,
        };
      }
      const mp4 = join(outDir, `${options.label}.mp4`);
      const recorder = await finishScreenRecord(adbExecutable, serial, recording, mp4);
      const times = probeFrameTimes(mp4);
      manifest.recording = { size, seconds: options.seconds, recorder, ...frameStats(times), frameTimesS: times };
      manifest.artifacts = [mp4];
      if (options.frames) {
        splitFrames(mp4, join(outDir, 'frames'));
        manifest.artifacts.push(join(outDir, 'frames'));
      }
    }
    manifest.status = 'ok';
  } catch (error) {
    failure = error;
    manifest.status = 'failed';
    manifest.failure = error.message;
  } finally {
    if (wmChanged) {
      tryCapture(adbExecutable, ['-s', serial, 'shell', 'wm', 'size', 'reset']);
      tryCapture(adbExecutable, ['-s', serial, 'shell', 'wm', 'density', 'reset']);
      const after = tryCapture(adbExecutable, ['-s', serial, 'shell', 'wm', 'size']);
      const afterDensity = tryCapture(adbExecutable, ['-s', serial, 'shell', 'wm', 'density']);
      manifest.wmAfterReset = { size: after, density: afterDensity };
    }
    writeManifest();
    log(`wrote ${manifestPath}`);
  }
  if (failure) throw failure;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const reset = () => {
    // Ctrl-C mid-capture must not leave a display override behind.
    try {
      const serialIndex = process.argv.indexOf('--serial');
      const serial = serialIndex > 0 ? process.argv[serialIndex + 1] : 'emulator-5556';
      const adbExecutable = join(resolveAndroidSdkRoot(), 'platform-tools', 'adb');
      tryCapture(adbExecutable, ['-s', serial, 'shell', 'wm', 'size', 'reset']);
      tryCapture(adbExecutable, ['-s', serial, 'shell', 'wm', 'density', 'reset']);
    } finally {
      process.exit(130);
    }
  };
  process.once('SIGINT', reset);
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
