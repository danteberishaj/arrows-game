// Shared adb, settings and launch plumbing for benchmark.mjs and capture.mjs (P-02 Stage B).
//
// Motion settings rule: a running Android process never sees a scale change.
// Reanimated reads Settings.Global.TRANSITION_ANIMATION_SCALE == 0 as reduced
// motion once, at app start (NativeProxy.kt, ReducedMotion.ts). So every
// capture sets all three scales, force-stops, launches, then records what the
// device READS BACK and what the running app REPORTS, never what was requested.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(SCRIPT_DIR, '../../..');
export const APPLICATION_ID = 'com.danteb.arrows';

export const MOTION_SCALE_KEYS = Object.freeze({
  windowAnimationScale: 'window_animation_scale',
  transitionAnimationScale: 'transition_animation_scale',
  animatorDurationScale: 'animator_duration_scale',
});

/** How long to wait for the app's own reduced-motion report after a launch. */
const APP_REDUCED_MOTION_TIMEOUT_MS = 8000; // OWNER-PICKED STARTING VALUE
const REDUCED_MOTION_LABEL = /perf-reduced-motion-([01])\b/;
export const UNAVAILABLE_NON_PERF = 'unavailable: non-PERF build';
export const UNAVAILABLE_PERF_WITHOUT_LABEL =
  'unavailable: PERF build without the P-02 reduced-motion label (built before P-02)';
export const UNAVAILABLE_UNKNOWN =
  'unavailable: no label (uiautomator could not dump the screen) and no [capture-diag] log line';

// ---------------------------------------------------------------- process

export function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? PROJECT_ROOT,
    env: options.env ?? process.env,
    encoding: 'utf8',
    timeout: options.timeout ?? 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${basename(command)} ${args.join(' ')} failed (${result.status})\n` +
        `${result.stdout ?? ''}${result.stderr ?? ''}`,
    );
  }
  return result.stdout.trim();
}

export function tryCapture(command, args, options = {}) {
  try {
    return capture(command, args, options);
  } catch {
    return null;
  }
}

export function adb(executable, serial, args, options) {
  return capture(executable, ['-s', serial, ...args], options);
}

/** Binary-safe adb exec-out (screencap -p and friends). */
export function adbBinary(executable, serial, args, timeout = 30_000) {
  const result = spawnSync(executable, ['-s', serial, 'exec-out', ...args], {
    encoding: null,
    timeout,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`adb exec-out ${args.join(' ')} failed (${result.status})`);
  return result.stdout;
}

export function delay(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function gitMetadata() {
  return {
    head: tryCapture('git', ['rev-parse', 'HEAD'], { cwd: PROJECT_ROOT }),
    branch: tryCapture('git', ['branch', '--show-current'], { cwd: PROJECT_ROOT }),
    dirty: Boolean(tryCapture('git', ['status', '--short'], { cwd: PROJECT_ROOT })),
  };
}

// ---------------------------------------------------------------- device

export function deviceIdentity(adbExecutable, serial) {
  const state = capture(adbExecutable, ['-s', serial, 'get-state']);
  if (state !== 'device') throw new Error(`${serial} is not ready`);
  const apiLevel = Number(adb(adbExecutable, serial, ['shell', 'getprop', 'ro.build.version.sdk']));
  const avd = tryCapture(adbExecutable, ['-s', serial, 'emu', 'avd', 'name'])
    ?.split(/\r?\n/)
    .find((line) => line && line !== 'OK') ?? null;
  return { serial, avd, apiLevel };
}

export function resolveActivity(adbExecutable, serial, applicationId = APPLICATION_ID) {
  const output = adb(adbExecutable, serial, [
    'shell', 'cmd', 'package', 'resolve-activity', '--brief',
    '-a', 'android.intent.action.MAIN',
    '-c', 'android.intent.category.LAUNCHER', applicationId,
  ]);
  const activity = output.split(/\r?\n/).find((line) => line.includes('/'));
  if (!activity) throw new Error(`Launcher activity was not resolved\n${output}`);
  return activity;
}

export function physicalDisplaySize(adbExecutable, serial) {
  const output = adb(adbExecutable, serial, ['shell', 'wm', 'size']);
  const match = output.match(/Physical size:\s*(\d+)x(\d+)/);
  const width = Number(match?.[1]);
  const height = Number(match?.[2]);
  if (!(width > 0) || !(height > 0)) throw new Error(`Could not parse display size\n${output}`);
  return { width, height };
}

/** `wm size` / `wm density` read-back, physical and override (null when none). */
export function readWm(adbExecutable, serial) {
  const size = adb(adbExecutable, serial, ['shell', 'wm', 'size']);
  const density = adb(adbExecutable, serial, ['shell', 'wm', 'density']);
  return {
    physicalSize: size.match(/Physical size:\s*(\d+x\d+)/)?.[1] ?? null,
    overrideSize: size.match(/Override size:\s*(\d+x\d+)/)?.[1] ?? null,
    physicalDensity: Number(density.match(/Physical density:\s*(\d+)/)?.[1] ?? NaN) || null,
    overrideDensity: Number(density.match(/Override density:\s*(\d+)/)?.[1] ?? NaN) || null,
    raw: { size, density },
  };
}

export function forceStop(adbExecutable, serial, applicationId = APPLICATION_ID) {
  adb(adbExecutable, serial, ['shell', 'am', 'force-stop', applicationId]);
}

export function launch(adbExecutable, serial, activity) {
  adb(adbExecutable, serial, ['shell', 'am', 'start', '-W', '-n', activity], { timeout: 30_000 });
}

export function appPid(adbExecutable, serial, applicationId = APPLICATION_ID) {
  const output = tryCapture(adbExecutable, ['-s', serial, 'shell', 'pidof', applicationId]) ?? '';
  const pids = output.split(/\s+/).filter((value) => /^\d+$/.test(value));
  return pids.length === 1 ? Number(pids[0]) : null;
}

export function dumpUiXml(adbExecutable, serial, remoteXml = '/data/local/tmp/arrows-capture.xml') {
  // uiautomator waits for the screen to go idle; it fails ("could not get idle
  // state") while something animates forever, e.g. the menu's Play pill at scale 1.
  const dumped = tryCapture(adbExecutable, ['-s', serial, 'shell', 'uiautomator', 'dump', remoteXml], {
    timeout: 20_000,
  });
  if (dumped === null || !dumped.includes('dumped')) return null;
  return tryCapture(adbExecutable, ['-s', serial, 'shell', 'cat', remoteXml]);
}

// ---------------------------------------------------------------- motion scales (pure)

export function parseMotionScale(value) {
  if (value === '0') return 0;
  if (value === '1') return 1;
  throw new Error(`--motion-scale must be 0 or 1 (got ${JSON.stringify(value)})`);
}

export function parseScaleReadBack(raw) {
  return Object.fromEntries(
    Object.keys(MOTION_SCALE_KEYS).map((field) => {
      const text = String(raw[field] ?? 'null').trim();
      const number = Number(text);
      return [field, text === 'null' || text === '' || !Number.isFinite(number) ? null : number];
    }),
  );
}

/**
 * The fields every result/manifest records. The scales are the device's
 * read-back; the request is deliberately not recorded here.
 */
export function motionEnvironment({ readBack, appReducedMotion, relaunched = true }) {
  const fields = {
    windowAnimationScale: readBack.windowAnimationScale,
    transitionAnimationScale: readBack.transitionAnimationScale,
    animatorDurationScale: readBack.animatorDurationScale,
    relaunchedAfterScaleChange: relaunched,
    appReducedMotion,
  };
  const reduced =
    appReducedMotion === true ||
    (typeof appReducedMotion === 'string' && readBack.transitionAnimationScale === 0);
  if (reduced) fields.reducedMotionVariantMeasured = true;
  return fields;
}

export function assertAppReducedMotionMatches(readBack, appReducedMotion) {
  if (typeof appReducedMotion !== 'boolean') return;
  const expected = readBack.transitionAnimationScale === 0;
  if (appReducedMotion !== expected) {
    throw new Error(
      `appReducedMotion=${appReducedMotion} disagrees with transition_animation_scale=` +
        `${readBack.transitionAnimationScale}: the app process started before the scale change ` +
        '(force-stop and relaunch after every settings put)',
    );
  }
}

export function parseReducedMotionLabel(xml) {
  const tag = xml?.match(/<node\b[^>]*>/g)?.find((candidate) => REDUCED_MOTION_LABEL.test(candidate));
  const match = tag?.match(REDUCED_MOTION_LABEL);
  return match ? match[1] === '1' : null;
}

export function parseReducedMotionLog(logcat) {
  const lines = String(logcat ?? '')
    .split(/\r?\n/)
    .filter((line) => line.includes('[capture-diag]'));
  const match = lines.at(-1)?.match(REDUCED_MOTION_LABEL);
  return match ? match[1] === '1' : null;
}

// ---------------------------------------------------------------- motion scales (device)

export function setMotionScales(adbExecutable, serial, scale, { keySuffix = '' } = {}) {
  for (const key of Object.values(MOTION_SCALE_KEYS)) {
    adb(adbExecutable, serial, ['shell', 'settings', 'put', 'global', `${key}${keySuffix}`, String(scale)]);
  }
}

export function readMotionScales(adbExecutable, serial) {
  return parseScaleReadBack(Object.fromEntries(
    Object.entries(MOTION_SCALE_KEYS).map(([field, key]) => [
      field,
      adb(adbExecutable, serial, ['shell', 'settings', 'get', 'global', key]),
    ]),
  ));
}

/**
 * Reads the running app's own useReducedMotion() value: the root label from a
 * uiautomator dump, or the [capture-diag] logcat line of the current process
 * when the screen animates too much to dump.
 */
export function readAppReducedMotion(adbExecutable, serial, { timeoutMs = APP_REDUCED_MOTION_TIMEOUT_MS } = {}) {
  const deadline = Date.now() + timeoutMs;
  let sawPerfNode = false;
  let dumpedOnce = false;
  for (;;) {
    const pid = appPid(adbExecutable, serial);
    if (pid !== null) {
      const log = tryCapture(adbExecutable, ['-s', serial, 'logcat', '-d', `--pid=${pid}`, '-s', 'ReactNativeJS:I']);
      const fromLog = parseReducedMotionLog(log);
      if (fromLog !== null) return { value: fromLog, source: 'logcat' };
    }
    const xml = dumpUiXml(adbExecutable, serial);
    if (xml !== null) {
      dumpedOnce = true;
      const fromLabel = parseReducedMotionLabel(xml);
      if (fromLabel !== null) return { value: fromLabel, source: 'uiautomator' };
      if (/perf-(game-screen|board)/.test(xml)) sawPerfNode = true;
    }
    if (Date.now() >= deadline) break;
    delay(300);
  }
  const value = sawPerfNode
    ? UNAVAILABLE_PERF_WITHOUT_LABEL
    : dumpedOnce
      ? UNAVAILABLE_NON_PERF
      : UNAVAILABLE_UNKNOWN;
  return { value, source: 'none' };
}

/**
 * Sets the three scales, force-stops, launches and reads everything back.
 * Diagnostics exist only to prove the instrument (acceptance B2):
 *  - bogusScaleKeys: `settings put` writes <key>_p02_bogus, so the real keys keep the device's values;
 *  - skipRelaunch: the app is first launched at the opposite scale and NOT restarted after the change.
 */
export function applyMotionScale(adbExecutable, serial, activity, scale, diagnostics = {}) {
  if (diagnostics.skipRelaunch) {
    setMotionScales(adbExecutable, serial, scale === 0 ? 1 : 0);
    forceStop(adbExecutable, serial);
    launch(adbExecutable, serial, activity);
    readAppReducedMotion(adbExecutable, serial);
  }
  setMotionScales(adbExecutable, serial, scale, {
    keySuffix: diagnostics.bogusScaleKeys ? '_p02_bogus' : '',
  });
  const relaunched = !diagnostics.skipRelaunch;
  if (relaunched) forceStop(adbExecutable, serial);
  launch(adbExecutable, serial, activity);
  const readBack = readMotionScales(adbExecutable, serial);
  const app = readAppReducedMotion(adbExecutable, serial);
  return {
    requestedScale: scale,
    readBack,
    appReducedMotion: app.value,
    appReducedMotionSource: app.source,
    relaunched,
    environment: motionEnvironment({ readBack, appReducedMotion: app.value, relaunched }),
  };
}
