#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildInputDriver, resolveAndroidSdkRoot } from './build-uiautomator.mjs';
import {
  parseGfxInfoFrames,
  parsePssCategoriesKb,
  parseTotalPssKb,
  summarizeFrames,
  summarizePss,
} from './parse-gfxinfo.mjs';
import {
  parseSurfaceFlingerLatency,
  summarizeSurfaceFrames,
} from './parse-surfaceflinger.mjs';
import {
  cellCenterForBoard,
  chunkTapPoints,
  evaluatePerformanceGate,
  parseExitInfoSignatures,
  summarizePssTrend,
} from './soak-utils.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '../../..');
const APPLICATION_ID = 'com.danteb.arrows';
const FIXED_LEVEL = 3827;
const GRID_SIZE = 39;
const FIT_MARGIN = 0.94;
const GESTURE_STEPS = 60;
const GESTURE_DURATION_MS = 1000;
const SOAK_TAP_INTERVAL_MS = 160;
const SOAK_CLEANUP_WINDOW_MS = 500;
// In frame-instrumented soaks, the stable end-of-batch to next-batch gap is
// about 1.91 s: 500 ms of deliberate cleanup plus gfxinfo/SurfaceFlinger
// probes. Match that cadence when the probes are disabled so memory-only and
// frame runs differ by instrumentation, not input pressure.
const SOAK_MEMORY_ONLY_INTER_BATCH_IDLE_MS = 1910;
const SOAK_WIN_FEEDBACK_SETTLE_MS = 1150;
const SOAK_FINAL_IDLE_MS = 5000;
// A tap is delivered from the UI runtime to JS and then back to a native prop.
// Keep the measured window open long enough to include that bounded handoff
// plus the complete feedback animation, rather than sampling only its start.
const FEEDBACK_START_GRACE_MS = 240;
// Sample every level after the same delay so ordinary deferred cleanup cannot
// make otherwise identical benchmark runs look different.
const SOAK_POST_LEVEL_SETTLE_MS = 500;
// Measure the exit effect at the densest point of the pinned 250-arrow board.
const EXIT_PHASE_STARTING_ARROW_COUNT = 250;
const EXIT_ANIMATION_DURATION_MS = parseExitAnimationDuration(
  process.env.EXPO_PUBLIC_PERF_EXIT_DURATION_MS,
);
const STEADY_STATE_SKIP_SAMPLES = 10;
const SOAK_PERFORMANCE_BUDGETS = Object.freeze({
  uiFrameP95Ms: 20,
  uiFrameP99Ms: 34,
  jankyFramePercent: 10,
  worstLevelUiFrameP95Ms: 34,
});
const GESTURE_PHASES = new Set(['zoomIn', 'panHorizontal', 'panVertical', 'zoomOut']);
const DEFAULT_PHASES = [...GESTURE_PHASES, 'blocked', 'exit'];
const VALID_PHASES = new Set(DEFAULT_PHASES);

function parseExitAnimationDuration(value) {
  const duration = Number(value ?? 180);
  return Number.isFinite(duration) && duration >= 160 && duration <= 1000
    ? duration
    : 180;
}

function log(message) {
  process.stderr.write(`[perf:android] ${message}\n`);
}

function parseArgs(argv) {
  const options = {
    serial: 'emulator-5556',
    avd: 'fleet_floor_api31',
    api: 31,
    level: FIXED_LEVEL,
    runs: 10,
    warmups: 1,
    apk: null,
    skipBuild: false,
    skipPrebuild: false,
    output: null,
    screenshot: null,
    label: null,
    expectSurface: null,
    feedback: false,
    diagnosticEmptyBoard: false,
    diagnosticNoExitTrails: false,
    memoryOnly: false,
    phases: [...DEFAULT_PHASES],
    soakLevels: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--skip-build') options.skipBuild = true;
    else if (option === '--skip-prebuild') options.skipPrebuild = true;
    else if (option === '--feedback') options.feedback = true;
    else if (option === '--diagnostic-empty-board') options.diagnosticEmptyBoard = true;
    else if (option === '--diagnostic-no-exit-trails') options.diagnosticNoExitTrails = true;
    else if (option === '--memory-only') options.memoryOnly = true;
    else if (option in VALUE_OPTIONS) {
      const value = argv[++index];
      if (value === undefined) throw new Error(`${option} requires a value`);
      options[VALUE_OPTIONS[option]] = value;
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
  }

  for (const key of ['api', 'level', 'runs', 'warmups']) options[key] = Number(options[key]);
  if (options.soakLevels !== null) options.soakLevels = Number(options.soakLevels);
  if (options.soakLevels === null && options.level !== FIXED_LEVEL) {
    throw new Error('The single-level workload is pinned to level 3827');
  }
  if (options.soakLevels !== null) {
    if (!Number.isInteger(options.soakLevels) || options.soakLevels < 20 || options.soakLevels > 50) {
      throw new Error('--soak-levels must be an integer from 20 through 50');
    }
    if (!Number.isSafeInteger(options.level) || options.level < 1) {
      throw new Error('--level must be greater than zero in soak mode');
    }
    // The long soak exercises the production feedback path while PERF_MODE
    // continues to isolate persistence, ads, and network work.
    options.feedback = true;
  }
  if (options.memoryOnly && options.soakLevels === null) {
    throw new Error('--memory-only requires --soak-levels');
  }
  if (options.serial !== 'emulator-5556') throw new Error('The workload is pinned to emulator-5556');
  if (options.api !== 31) throw new Error('The workload is pinned to API 31');
  if (!Number.isInteger(options.runs) || options.runs < 1) throw new Error('--runs must be positive');
  if (!Number.isInteger(options.warmups) || options.warmups < 0) throw new Error('--warmups must be non-negative');
  if (typeof options.phases === 'string') {
    options.phases = options.phases.split(',').map((phase) => phase.trim()).filter(Boolean);
  }
  if (options.phases.length === 0 || options.phases.some((phase) => !VALID_PHASES.has(phase))) {
    throw new Error(`--phases must contain only: ${DEFAULT_PHASES.join(',')}`);
  }
  if (new Set(options.phases).size !== options.phases.length) {
    throw new Error('--phases must not contain duplicates');
  }
  if (options.apk) options.apk = resolve(options.apk);
  if (options.output) options.output = resolve(options.output);
  if (options.screenshot) options.screenshot = resolve(options.screenshot);
  if (options.expectSurface && !['rootWindow', 'surfaceView'].includes(options.expectSurface)) {
    throw new Error('--expect-surface must be rootWindow or surfaceView');
  }
  return options;
}

function benchmarkConfiguration(options) {
  if (options.skipBuild) {
    return {
      configurationVerifiedFromFreshBuild: false,
      nativePrebuildRecreated: false,
      productionRenderer: null,
      staticBoardRenderer: 'unverified-caller-supplied-apk',
      skiaLifecycleBackport: 'unverified-caller-supplied-apk',
      skiaPictureMutexBackport: 'unverified-caller-supplied-apk',
      skiaNativeWindowOwnershipBackport: 'unverified-caller-supplied-apk',
      skiaPathReplayAllocationPatch: 'unverified-caller-supplied-apk',
      runtimeMemoryFix: 'unverified-caller-supplied-apk',
      runtimeVersions: null,
      tapGestureThread: 'unverified-caller-supplied-apk',
      boardSurfaceLifetime: 'unverified-caller-supplied-apk',
      arrowArtCache: 'unverified-caller-supplied-apk',
      remainingLabelLayout: 'unverified-caller-supplied-apk',
      boardSurfaceOpacity: 'unverified-caller-supplied-apk',
      exitTrailCleanup: 'unverified-caller-supplied-apk',
      exitTrailPolicy: 'unverified-caller-supplied-apk',
      exitTrailDurationMs: null,
    };
  }

  const emptyBoard =
    options.diagnosticEmptyBoard ||
    (options.soakLevels === null && process.env.EXPO_PUBLIC_PERF_EMPTY_BOARD === '1');
  const opaqueSurface =
    options.soakLevels === null && process.env.EXPO_PUBLIC_PERF_OPAQUE_SURFACE === '1';
  const exitTrailsDisabled =
    options.diagnosticNoExitTrails ||
    (options.soakLevels === null && process.env.EXPO_PUBLIC_PERF_NO_EXIT_TRAILS === '1');
  const productionRenderer =
    !emptyBoard &&
    !opaqueSurface &&
    !exitTrailsDisabled &&
    EXIT_ANIMATION_DURATION_MS === 180;
  return {
    configurationVerifiedFromFreshBuild: true,
    nativePrebuildRecreated: !options.skipPrebuild,
    productionRenderer,
    staticBoardRenderer: emptyBoard
      ? 'empty-board-diagnostic'
      : 'expo-native-view-retained-compound-paths',
    skiaLifecycleBackport: '89f6954',
    skiaPictureMutexBackport: 'eef2afa',
    skiaNativeWindowOwnershipBackport: 'local-ndk-acquire-release-fix',
    skiaPathReplayAllocationPatch: 'local-no-copy-fast-path',
    runtimeMemoryFix: 'expo-57.0.18-rn-0.86.3-worklets-0.10.1',
    runtimeVersions: Object.fromEntries(
      [
        'expo',
        'react-native',
        'react-native-reanimated',
        'react-native-worklets',
        '@shopify/react-native-skia',
      ].map((packageName) => [
        packageName,
        JSON.parse(readFileSync(
          join(PROJECT_ROOT, 'node_modules', packageName, 'package.json'),
          'utf8',
        )).version,
      ]),
    ),
    tapGestureThread: 'ui-coordinate-snapshot-to-js',
    boardSurfaceLifetime: 'native-board-plus-persistent-dynamic-skia',
    arrowArtCache: emptyBoard
      ? 'not-exercised'
      : 'per-board-serialized-geometry-and-native-retained-paths',
    remainingLabelLayout: 'split-static-mission-and-bounded-counter',
    boardSurfaceOpacity: opaqueSurface ? 'opaque-diagnostic' : 'transparent',
    exitTrailCleanup: exitTrailsDisabled
      ? 'disabled-diagnostic'
      : 'two-bounded-native-or-skia-slots',
    exitTrailPolicy: exitTrailsDisabled
      ? 'disabled-diagnostic'
      : 'dense-native-launch-over-64-otherwise-full-slither',
    exitTrailDurationMs: EXIT_ANIMATION_DURATION_MS,
  };
}

const VALUE_OPTIONS = {
  '--serial': 'serial',
  '--avd': 'avd',
  '--api': 'api',
  '--level': 'level',
  '--runs': 'runs',
  '--warmups': 'warmups',
  '--apk': 'apk',
  '--output': 'output',
  '--screenshot': 'screenshot',
  '--label': 'label',
  '--expect-surface': 'expectSurface',
  '--phases': 'phases',
  '--soak-levels': 'soakLevels',
};

function capture(command, args, options = {}) {
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

function tryCapture(command, args, options = {}) {
  try {
    return capture(command, args, options);
  } catch {
    return null;
  }
}

function runBuild(command, args, options = {}) {
  log(`${basename(command)} ${args.join(' ')}`);
  const output = capture(command, args, { ...options, timeout: 20 * 60_000 });
  const tail = output.split(/\r?\n/).slice(-8).join('\n');
  if (tail) log(tail);
}

function createSoakPlan(options) {
  const tsxCli = join(PROJECT_ROOT, 'node_modules/tsx/dist/cli.mjs');
  if (!existsSync(tsxCli)) throw new Error(`tsx CLI does not exist: ${tsxCli}`);
  const output = capture(process.execPath, [
    tsxCli,
    join(SCRIPT_DIR, 'soak-plan.ts'),
    '--start-level', String(options.level),
    '--measured-levels', String(options.soakLevels),
  ]);
  let plan;
  try {
    plan = JSON.parse(output);
  } catch (error) {
    throw new Error(`Could not parse the generated soak plan: ${error.message}`);
  }
  if (
    plan.schemaVersion !== 1 ||
    plan.startLevelIndex !== options.level ||
    plan.measuredLevelCount !== options.soakLevels ||
    plan.measured?.length !== options.soakLevels ||
    plan.warmup?.levelIndex !== options.level - 1
  ) {
    throw new Error('Generated soak plan did not match the requested contiguous level range');
  }
  return plan;
}

function createSingleLevelPlan() {
  return createSoakPlan({ level: FIXED_LEVEL, soakLevels: 20 }).measured[0];
}

function adb(executable, serial, args, options) {
  return capture(executable, ['-s', serial, ...args], options);
}

function delay(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function validateDevice(sdkRoot, options) {
  const adbExecutable = join(sdkRoot, 'platform-tools', 'adb');
  const state = capture(adbExecutable, ['-s', options.serial, 'get-state']);
  if (state !== 'device') throw new Error(`${options.serial} is not ready`);

  const api = Number(adb(adbExecutable, options.serial, ['shell', 'getprop', 'ro.build.version.sdk']));
  if (api !== options.api) throw new Error(`Expected API ${options.api}, found ${api}`);
  const actualAvd = adb(adbExecutable, options.serial, ['emu', 'avd', 'name'])
    .split(/\r?\n/)
    .find((line) => line && line !== 'OK');
  if (actualAvd !== options.avd) throw new Error(`Expected AVD ${options.avd}, found ${actualAvd}`);

  adb(adbExecutable, options.serial, ['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
  tryCapture(adbExecutable, ['-s', options.serial, 'shell', 'wm', 'dismiss-keyguard']);
  for (const [namespace, key, value] of [
    ['global', 'window_animation_scale', '0'],
    ['global', 'transition_animation_scale', '0'],
    ['global', 'animator_duration_scale', '0'],
    ['system', 'peak_refresh_rate', '60.0'],
    ['system', 'min_refresh_rate', '60.0'],
  ]) {
    adb(adbExecutable, options.serial, ['shell', 'settings', 'put', namespace, key, value]);
  }
  tryCapture(adbExecutable, [
    '-s', options.serial, 'shell', 'cmd', 'power', 'set-fixed-performance-mode-enabled', 'true',
  ]);
  return adbExecutable;
}

function buildRelease(options) {
  const apk = options.apk ?? join(
    PROJECT_ROOT,
    'android/app/build/outputs/apk/release/app-release.apk',
  );
  if (options.skipBuild) return apk;

  const nodeBin = dirname(process.execPath);
  const buildEnv = {
    ...process.env,
    PATH: `${nodeBin}:${process.env.PATH ?? ''}`,
    CI: '1',
    ARROWS_PERF_BUILD: '1',
    // A soak warms up on the immediately preceding level, then advances into
    // the requested measured range without restarting the Android process.
    EXPO_PUBLIC_PERF_LEVEL: String(
      options.soakLevels === null ? options.level : options.level - 1,
    ),
    // Metro inlines EXPO_PUBLIC_* values. Keep every benchmark switch explicit
    // so an earlier variant cannot leak into a later build through task state.
    EXPO_PUBLIC_PERF_EMPTY_BOARD:
      options.diagnosticEmptyBoard ||
      (options.soakLevels === null && process.env.EXPO_PUBLIC_PERF_EMPTY_BOARD === '1') ? '1' : '0',
    EXPO_PUBLIC_PERF_OPAQUE_SURFACE:
      options.soakLevels === null && process.env.EXPO_PUBLIC_PERF_OPAQUE_SURFACE === '1' ? '1' : '0',
    EXPO_PUBLIC_PERF_NO_EXIT_TRAILS:
      options.diagnosticNoExitTrails ||
      (options.soakLevels === null && process.env.EXPO_PUBLIC_PERF_NO_EXIT_TRAILS === '1')
        ? '1'
        : '0',
    EXPO_PUBLIC_PERF_EXIT_DURATION_MS:
      String(EXIT_ANIMATION_DURATION_MS),
    EXPO_PUBLIC_PERF_FEEDBACK: options.feedback ? '1' : '0',
  };
  if (!options.skipPrebuild) {
    runBuild(process.execPath, [
      join(PROJECT_ROOT, 'node_modules/expo/bin/cli'),
      'prebuild', '--platform', 'android', '--clean', '--no-install',
    ], { env: buildEnv });
  }
  // Expo intentionally disables Metro's --reset-cache in CI. Gradle's bundle
  // task already supplies that flag, and benchmark variants depend on it
  // because EXPO_PUBLIC_* values are inlined during transformation.
  const gradleEnv = { ...buildEnv };
  delete gradleEnv.CI;
  // Expo's public environment variables are compile-time bundle inputs, but
  // Gradle does not model them as task inputs. Remove only generated bundle
  // outputs so changing a benchmark flag cannot silently reuse the prior APK.
  // Removing the merged bundle alone is insufficient: packageRelease can still
  // consider its already-written APK up to date after the bundle is recreated.
  for (const generatedOutput of [
    'app/build/generated/assets/react/release',
    'app/build/generated/res/react/release',
    'app/build/generated/sourcemaps/react/release',
    'app/build/intermediates/assets/release/mergeReleaseAssets',
    'app/build/outputs/apk/release',
  ]) {
    const outputPath = join(PROJECT_ROOT, 'android', generatedOutput);
    if (existsSync(outputPath)) rmSync(outputPath, { recursive: true, force: true });
  }
  const gradle = join(PROJECT_ROOT, 'android', 'gradlew');
  runBuild(gradle, [
    ':app:assembleRelease',
    '-PreactNativeArchitectures=arm64-v8a',
    '--no-daemon',
    '--console=plain',
  ], { cwd: join(PROJECT_ROOT, 'android'), env: gradleEnv });
  return apk;
}

function validateApk(apk, sdkRoot) {
  if (!existsSync(apk)) throw new Error(`APK does not exist: ${apk}`);
  const analyzer = [
    join(sdkRoot, 'cmdline-tools/latest/bin/apkanalyzer'),
    join(sdkRoot, 'tools/bin/apkanalyzer'),
  ].find(existsSync);
  if (!analyzer) throw new Error('apkanalyzer was not found');

  const applicationId = capture(analyzer, ['manifest', 'application-id', apk]);
  const debuggable = capture(analyzer, ['manifest', 'debuggable', apk]);
  const manifest = capture(analyzer, ['manifest', 'print', apk]);
  if (applicationId !== APPLICATION_ID) throw new Error(`Unexpected application id: ${applicationId}`);
  if (debuggable !== 'false') throw new Error(`Release APK is debuggable: ${debuggable}`);
  if (!/<profileable\b[^>]*android:shell="true"/.test(manifest)) {
    throw new Error('Release APK is not shell-profileable');
  }

  const bytes = readFileSync(apk);
  return {
    path: apk,
    applicationId,
    debuggable: false,
    profileable: true,
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function findBoardBounds(context) {
  const remoteXml = '/data/local/tmp/arrows-perf-window.xml';
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const dumped = tryCapture(context.adbExecutable, [
      '-s', context.serial, 'shell', 'uiautomator', 'dump', remoteXml,
    ], { timeout: 15_000 });
    if (dumped !== null) {
      const xml = tryCapture(context.adbExecutable, [
        '-s', context.serial, 'shell', 'cat', remoteXml,
      ]);
      const node = xml
        ?.match(/<node\b[^>]*>/g)
        ?.find((tag) =>
          /resource-id="[^"]*perf-board"/.test(tag) ||
          /content-desc="perf-board"/.test(tag));
      const bounds = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      if (bounds) {
        const [, left, top, right, visibleBottom] = bounds.map(Number);
        // The edge-to-edge React root extends behind Android's navigation bar,
        // while accessibility clips bounds above it. Layout/transform math uses
        // the full display bottom, so taps must use that same viewport height.
        const bottom = Math.max(visibleBottom, context.displayHeight);
        if (right > left && bottom > top) return { left, top, right, bottom };
      }
    }
    delay(250);
  }
  throw new Error('perf-board did not appear in the accessibility tree');
}

function invokeGestureDriver(context, args) {
  const output = adb(context.adbExecutable, context.serial, [
    'shell',
    `CLASSPATH=${context.remoteJar}`,
    'app_process',
    '/system/bin',
    'com.arrows.perf.ArrowsWorkload',
    ...args,
  ], { timeout: 30_000 });
  const jsonLine = output.split(/\r?\n/).find((line) => line.trim().startsWith('{'));
  if (!jsonLine) throw new Error(`gesture driver returned no timing data\n${output}`);
  return JSON.parse(jsonLine);
}

function runGestureDriver(context, mode, points, steps, durationMs) {
  const timing = invokeGestureDriver(context, [
    mode,
    ...points.flatMap((point) => [String(point.x), String(point.y)]),
    String(steps),
    String(durationMs),
  ]);
  if (timing.acceptedMoves !== steps) {
    throw new Error(`${mode} accepted ${timing.acceptedMoves}/${steps} move events`);
  }
  // The shell process can be descheduled while a software-GPU emulator is
  // saturated. Reject an under-paced or badly stalled driver, but tolerate a
  // bounded overrun and retain the exact duration in every sample.
  if (timing.durationMs < durationMs - 100 || timing.durationMs > durationMs + 250) {
    throw new Error(`${mode} duration ${timing.durationMs} ms was not paced to ${durationMs} ms`);
  }
  return timing;
}

function runTapSequence(context, points, intervalMs = SOAK_TAP_INTERVAL_MS) {
  if (points.length < 1 || points.length > 8) {
    throw new Error(`tap-sequence requires 1..8 points, received ${points.length}`);
  }
  const timing = invokeGestureDriver(context, [
    'tap-sequence',
    String(intervalMs),
    ...points.flatMap((point) => [String(point.x), String(point.y)]),
  ]);
  if (timing.acceptedTaps !== points.length) {
    throw new Error(`tap-sequence accepted ${timing.acceptedTaps}/${points.length} taps`);
  }
  const expectedDurationMs = (points.length - 1) * intervalMs + 32;
  if (
    timing.durationMs < expectedDurationMs - 100 ||
    timing.durationMs > expectedDurationMs + 300
  ) {
    throw new Error(
      `tap-sequence duration ${timing.durationMs} ms was not paced near ${expectedDurationMs} ms`,
    );
  }
  return timing;
}

function runPinch(context, start1, start2, end1, end2, steps, durationMs) {
  return runGestureDriver(
    context,
    'pinch',
    [start1, start2, end1, end2],
    steps,
    durationMs,
  );
}

function runPan(context, start, end, steps, durationMs) {
  return runGestureDriver(context, 'pan', [start, end], steps, durationMs);
}

function cellCenter(bounds, row, col, rows = GRID_SIZE, cols = GRID_SIZE) {
  return cellCenterForBoard(bounds, row, col, rows, cols, FIT_MARGIN);
}

function tapCell(context, bounds, row, col) {
  const { x, y } = cellCenter(bounds, row, col);
  adb(context.adbExecutable, context.serial, ['shell', 'input', 'tap', String(x), String(y)]);
}

function timedTapCell(context, bounds, row, col, animationDurationMs) {
  const point = cellCenter(bounds, row, col);
  const timing = invokeGestureDriver(context, ['tap', String(point.x), String(point.y)]);
  return {
    ...timing,
    captureDurationMs: timing.durationMs + animationDurationMs + FEEDBACK_START_GRACE_MS,
    captureStartNs: timing.startNs,
    captureEndNs:
      (
        BigInt(timing.endNs) +
        BigInt(animationDurationMs + FEEDBACK_START_GRACE_MS) * 1_000_000n
      ).toString(),
  };
}

function gestureGeometry(bounds) {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const cx = Math.round((bounds.left + bounds.right) / 2);
  const cy = Math.round((bounds.top + bounds.bottom) / 2);
  const inner = Math.max(32, Math.round(width / 16));
  // BoardView clamps at 3.5x its fit scale. Reach that limit on the final
  // injected MOVE instead of spending the tail of the sample at the clamp.
  const outer = Math.round(inner * 3.5);
  return {
    cx,
    cy,
    inner,
    outer,
    left: bounds.left + Math.round(width / 4),
    right: bounds.right - Math.round(width / 4),
    top: bounds.top + Math.round(height / 3),
    bottom: bounds.bottom - Math.round(height / 3),
  };
}

function zoomIn(context, geometry, steps = GESTURE_STEPS, durationMs = GESTURE_DURATION_MS) {
  const { cx, cy, inner, outer } = geometry;
  return runPinch(
    context,
    { x: cx - inner, y: cy },
    { x: cx + inner, y: cy },
    { x: cx - outer, y: cy },
    { x: cx + outer, y: cy },
    steps,
    durationMs,
  );
}

function prepareExitTrailWorkload(context, bounds, levelPlan) {
  const startingArrowCount = EXIT_PHASE_STARTING_ARROW_COUNT;
  if (levelPlan.arrowCount < startingArrowCount) {
    throw new Error(`Exit workload requires at least ${startingArrowCount} arrows`);
  }
  const prefixTapCount = levelPlan.arrowCount - startingArrowCount;
  const prefixPoints = levelPlan.taps
    .slice(0, prefixTapCount)
    .map(({ row, col }) => cellCenter(
      bounds,
      row,
      col,
      levelPlan.rows,
      levelPlan.cols,
    ));
  for (const chunk of chunkTapPoints(prefixPoints, 8, 1)) {
    runTapSequence(context, chunk);
  }
  waitForUiText(context, `${startingArrowCount} left`);
  delay(220);
}

function prepareWorkload(context, phase, bounds, levelPlan) {
  if (phase === 'exit') {
    prepareExitTrailWorkload(context, bounds, levelPlan);
    return;
  }
  if (!['panHorizontal', 'panVertical', 'zoomOut'].includes(phase)) return;
  zoomIn(context, gestureGeometry(bounds), 30, 500);
  delay(100);
}

function runWorkload(context, phase, bounds, levelPlan) {
  if (phase === 'blocked') {
    const timing = timedTapCell(context, bounds, 35, 19, 300);
    delay(500);
    return timing;
  }
  if (phase === 'exit') {
    const tapIndex = levelPlan.arrowCount - EXIT_PHASE_STARTING_ARROW_COUNT;
    const { row, col } = levelPlan.taps[tapIndex];
    const timing = timedTapCell(context, bounds, row, col, EXIT_ANIMATION_DURATION_MS);
    delay(EXIT_ANIMATION_DURATION_MS + 260);
    return timing;
  }
  if (!GESTURE_PHASES.has(phase)) throw new Error(`Unknown phase: ${phase}`);

  const geometry = gestureGeometry(bounds);
  const { cx, cy, inner, outer, left, right, top, bottom } = geometry;
  let timing;
  if (phase === 'zoomIn') {
    timing = zoomIn(context, geometry);
  } else if (phase === 'zoomOut') {
    timing = runPinch(
      context,
      { x: cx - outer, y: cy },
      { x: cx + outer, y: cy },
      { x: cx - inner, y: cy },
      { x: cx + inner, y: cy },
      GESTURE_STEPS,
      GESTURE_DURATION_MS,
    );
  } else if (phase === 'panHorizontal') {
    timing = runPan(
      context,
      { x: left, y: cy },
      { x: right, y: cy },
      GESTURE_STEPS,
      GESTURE_DURATION_MS,
    );
  } else {
    timing = runPan(
      context,
      { x: cx, y: top },
      { x: cx, y: bottom },
      GESTURE_STEPS,
      GESTURE_DURATION_MS,
    );
  }
  delay(70); // allow at most four final compositor refreshes before dumping
  return timing;
}

function resolveActivity(adbExecutable, serial) {
  const output = adb(adbExecutable, serial, [
    'shell', 'cmd', 'package', 'resolve-activity', '--brief',
    '-a', 'android.intent.action.MAIN',
    '-c', 'android.intent.category.LAUNCHER', APPLICATION_ID,
  ]);
  const activity = output.split(/\r?\n/).find((line) => line.includes('/'));
  if (!activity) throw new Error(`Launcher activity was not resolved\n${output}`);
  return activity;
}

function physicalDisplayHeight(adbExecutable, serial) {
  const output = adb(adbExecutable, serial, ['shell', 'wm', 'size']);
  const height = Number(output.match(/Physical size:\s*\d+x(\d+)/)?.[1]);
  if (!Number.isFinite(height) || height < 1) throw new Error(`Could not parse display size\n${output}`);
  return height;
}

function startReady(context) {
  adb(context.adbExecutable, context.serial, ['shell', 'am', 'force-stop', APPLICATION_ID]);
  adb(context.adbExecutable, context.serial, [
    'shell', 'am', 'start', '-W', '-n', context.activity,
  ], { timeout: 30_000 });
  const bounds = findBoardBounds(context);
  delay(700); // board layout, fit transform, and 180 ms entrance fade
  return bounds;
}

function resolveSurfaceLayers(context) {
  const layers = adb(context.adbExecutable, context.serial, [
    'shell', 'dumpsys', 'SurfaceFlinger', '--list',
  ]).split(/\r?\n/);
  const surfaceViews = layers.filter((layer) =>
    layer.startsWith(`SurfaceView[${APPLICATION_ID}/`) && layer.includes('(BLAST)#'));
  const appWindows = layers.filter((layer) =>
    layer.startsWith(`${APPLICATION_ID}/`) && /#\d+$/.test(layer));
  if (appWindows.length !== 1) {
    throw new Error(`Expected one live app window layer, found ${appWindows.length}`);
  }
  if (surfaceViews.length > 1) {
    throw new Error(`Expected at most one live board SurfaceView, found ${surfaceViews.length}`);
  }
  const root = appWindows[0];
  const surfaceView = surfaceViews[0] ?? null;
  return { root, board: surfaceView ?? root, surfaceView };
}

function surfaceFlinger(context, option, layer) {
  return adb(context.adbExecutable, context.serial, [
    'shell', `dumpsys SurfaceFlinger ${option} '${layer}'`,
  ]);
}

function summarizeOptionalGfxFrames(frames) {
  if (frames.length > 0) return summarizeFrames(frames);
  return {
    frameCount: 0,
    uiFrameP50Ms: null,
    uiFrameP95Ms: null,
    uiFrameP99Ms: null,
    uiFrameMaxMs: null,
    jankyFramePercent: null,
  };
}

function measurePhase(context, phase, levelPlan) {
  const bounds = startReady(context);
  prepareWorkload(context, phase, bounds, levelPlan);
  const surfaceLayers = resolveSurfaceLayers(context);
  for (const layer of new Set([surfaceLayers.root, surfaceLayers.board])) {
    surfaceFlinger(context, '--latency-clear', layer);
  }
  adb(context.adbExecutable, context.serial, [
    'shell', 'dumpsys', 'gfxinfo', APPLICATION_ID, 'reset',
  ]);
  const driverTiming = runWorkload(context, phase, bounds, levelPlan);
  const gfxInfo = adb(context.adbExecutable, context.serial, [
    'shell', 'dumpsys', 'gfxinfo', APPLICATION_ID, 'framestats',
  ]);
  const memInfo = adb(context.adbExecutable, context.serial, [
    'shell', 'dumpsys', 'meminfo', APPLICATION_ID,
  ]);
  const timingWindow = driverTiming
    ? {
        startNs: driverTiming.captureStartNs ?? driverTiming.startNs,
        endNs: driverTiming.captureEndNs ?? driverTiming.endNs,
      }
    : null;
  const surfaces = Object.fromEntries(
    Object.entries({ root: surfaceLayers.root, board: surfaceLayers.board }).map(([key, layer]) => {
      const latency = surfaceFlinger(context, '--latency', layer);
      return [key, {
        layer,
        ...parseSurfaceFlingerLatency(latency, timingWindow),
      }];
    }),
  );
  if (GESTURE_PHASES.has(phase)) {
    const retainedCount = surfaces.board.frames.length;
    const rawCount = surfaces.board.rawFrameCount;
    if (rawCount >= 120) {
      throw new Error(`${phase} filled the SurfaceFlinger history (${rawCount} frames)`);
    }
    if (retainedCount < 5) {
      throw new Error(`${phase} retained only ${retainedCount} visual-board frames`);
    }
  }
  return {
    frames: parseGfxInfoFrames(gfxInfo),
    surfaceLayers,
    surfaces,
    driverTiming,
    pssKb: parseTotalPssKb(memInfo),
  };
}

function dumpUi(context) {
  const remoteXml = '/data/local/tmp/arrows-perf-assert.xml';
  adb(context.adbExecutable, context.serial, [
    'shell', 'uiautomator', 'dump', remoteXml,
  ], { timeout: 15_000 });
  return adb(context.adbExecutable, context.serial, ['shell', 'cat', remoteXml]);
}

function assertUiContains(context, expected) {
  const xml = dumpUi(context);
  if (!xml.includes(expected)) {
    throw new Error(`UI assertion failed: expected ${JSON.stringify(expected)}`);
  }
}

function waitForUi(context, predicate, description, attempts = 20) {
  let latestXml = '';
  let latestError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      latestXml = dumpUi(context);
      latestError = null;
      const result = predicate(latestXml);
      if (result) return result;
    } catch (error) {
      latestError = error;
    }
    delay(100);
  }
  const detail = latestError?.message ?? latestXml.slice(0, 2_000);
  throw new Error(`UI did not reach ${description}\n${detail}`);
}

function waitForUiText(context, expected) {
  return waitForUi(
    context,
    (xml) => xml.includes(expected),
    JSON.stringify(expected),
  );
}

function waitForLevelReady(context, level) {
  return waitForUi(
    context,
    (xml) =>
      xml.includes(`LEVEL ${level.displayedLevel}`) &&
      xml.includes(`${level.arrowCount} left`),
    `level ${level.displayedLevel} with ${level.arrowCount} arrows`,
  );
}

function waitForTextBounds(context, expectedText) {
  return waitForUi(
    context,
    (xml) => {
      const tag = xml
        .match(/<node\b[^>]*>/g)
        ?.find((candidate) =>
          candidate.includes(`text="${expectedText}"`) ||
          candidate.includes(`content-desc="${expectedText}"`));
      const bounds = tag?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      if (!bounds) return null;
      const [, left, top, right, bottom] = bounds.map(Number);
      if (right <= left || bottom <= top) return null;
      return { left, top, right, bottom };
    },
    `${JSON.stringify(expectedText)} button`,
  );
}

function tapBounds(context, bounds) {
  return invokeGestureDriver(context, [
    'tap',
    String(Math.round((bounds.left + bounds.right) / 2)),
    String(Math.round((bounds.top + bounds.bottom) / 2)),
  ]);
}

function validateWorkload(context, levelPlan) {
  log('validating deterministic workload');
  let bounds = startReady(context);
  assertUiContains(context, 'LEVEL 3828');
  assertUiContains(context, '250 left');
  prepareExitTrailWorkload(context, bounds, levelPlan);
  const exitTap = levelPlan.taps[
    levelPlan.arrowCount - EXIT_PHASE_STARTING_ARROW_COUNT
  ];
  tapCell(context, bounds, exitTap.row, exitTap.col);
  delay(500);
  assertUiContains(context, `${EXIT_PHASE_STARTING_ARROW_COUNT - 1} left`);

  bounds = startReady(context);
  for (let tap = 0; tap < 3; tap += 1) {
    tapCell(context, bounds, 35, 19);
    delay(400);
  }
  delay(400);
  assertUiContains(context, 'Out of hearts');
}

function readPssCategories(context) {
  const memInfo = adb(context.adbExecutable, context.serial, [
    'shell', 'dumpsys', 'meminfo', APPLICATION_ID,
  ]);
  return parsePssCategoriesKb(memInfo);
}

function runningPid(context) {
  const output = adb(context.adbExecutable, context.serial, [
    'shell', 'pidof', APPLICATION_ID,
  ]);
  const pids = output.split(/\s+/).filter((value) => /^\d+$/.test(value));
  if (pids.length !== 1) throw new Error(`Expected one ${APPLICATION_ID} PID, found: ${output}`);
  return Number(pids[0]);
}

function readExitInfo(context) {
  return adb(context.adbExecutable, context.serial, [
    'shell', 'dumpsys', 'activity', 'exit-info', APPLICATION_ID,
  ]);
}

function createProcessHealthBaseline(context) {
  const baseline = {
    pid: runningPid(context),
    exitInfo: parseExitInfoSignatures(readExitInfo(context)),
    lastAnr: adb(context.adbExecutable, context.serial, [
      'shell', 'dumpsys', 'activity', 'lastanr',
    ]).trim(),
  };
  tryCapture(context.adbExecutable, ['-s', context.serial, 'logcat', '-c']);
  return baseline;
}

function assertProcessHealthy(context, baseline) {
  const pid = runningPid(context);
  if (pid !== baseline.pid) {
    throw new Error(`App PID changed during soak: ${baseline.pid} -> ${pid}`);
  }

  const currentExitInfo = parseExitInfoSignatures(readExitInfo(context));
  const newExitInfo = [...currentExitInfo].filter((signature) => !baseline.exitInfo.has(signature));
  if (newExitInfo.length > 0) {
    throw new Error(`Android recorded a process exit during soak: ${newExitInfo.join('; ')}`);
  }

  const lastAnr = adb(context.adbExecutable, context.serial, [
    'shell', 'dumpsys', 'activity', 'lastanr',
  ]).trim();
  if (lastAnr !== baseline.lastAnr && lastAnr.includes(APPLICATION_ID)) {
    throw new Error(`Android recorded an ANR for ${APPLICATION_ID}`);
  }

  const crashLog = tryCapture(context.adbExecutable, [
    '-s', context.serial, 'logcat', '-d', '-b', 'crash', '-v', 'brief',
  ]) ?? '';
  const errorLog = tryCapture(context.adbExecutable, [
    '-s', context.serial, 'logcat', '-d', '-v', 'brief',
    'ActivityManager:E', 'AndroidRuntime:E', '*:S',
  ]) ?? '';
  if (
    crashLog.includes(APPLICATION_ID) ||
    (crashLog.includes('FATAL EXCEPTION') && crashLog.includes(String(pid))) ||
    errorLog.includes(`ANR in ${APPLICATION_ID}`) ||
    (errorLog.includes('FATAL EXCEPTION') && errorLog.includes(String(pid)))
  ) {
    throw new Error(`Crash or ANR log detected for PID ${pid}`);
  }

  return { pid, newExitInfoCount: 0, anrDetected: false, crashDetected: false };
}

function emptyFrameAggregate() {
  return { ui: [], board: [], root: [], boardRefreshPeriodMs: null, rootRefreshPeriodMs: null };
}

function appendFrameSample(aggregate, sample) {
  aggregate.ui.push(...sample.frames);
  aggregate.board.push(...sample.surfaces.board.frames);
  aggregate.root.push(...sample.surfaces.root.frames);
  aggregate.boardRefreshPeriodMs = sample.surfaces.board.refreshPeriodMs;
  aggregate.rootRefreshPeriodMs = sample.surfaces.root.refreshPeriodMs;
}

function appendFrameAggregate(target, source) {
  target.ui.push(...source.ui);
  target.board.push(...source.board);
  target.root.push(...source.root);
  target.boardRefreshPeriodMs = source.boardRefreshPeriodMs ?? target.boardRefreshPeriodMs;
  target.rootRefreshPeriodMs = source.rootRefreshPeriodMs ?? target.rootRefreshPeriodMs;
}

function summarizeFrameAggregate(aggregate) {
  return {
    ...summarizeOptionalGfxFrames(aggregate.ui),
    ...summarizeSurfaceFrames(aggregate.board, aggregate.boardRefreshPeriodMs ?? 1000 / 60),
    rootSurface: summarizeSurfaceFrames(
      aggregate.root,
      aggregate.rootRefreshPeriodMs ?? 1000 / 60,
    ),
  };
}

function measureFrameWindow(context, workload, settleMs = 70) {
  const surfaceLayers = resolveSurfaceLayers(context);
  for (const layer of new Set([surfaceLayers.root, surfaceLayers.board])) {
    surfaceFlinger(context, '--latency-clear', layer);
  }
  adb(context.adbExecutable, context.serial, [
    'shell', 'dumpsys', 'gfxinfo', APPLICATION_ID, 'reset',
  ]);
  const driverTiming = workload();
  if (settleMs > 0) delay(settleMs);
  const gfxInfo = adb(context.adbExecutable, context.serial, [
    'shell', 'dumpsys', 'gfxinfo', APPLICATION_ID, 'framestats',
  ]);
  const endingSurfaceLayers = resolveSurfaceLayers(context);
  if (endingSurfaceLayers.root !== surfaceLayers.root) {
    throw new Error('The app window surface changed during a same-activity soak window');
  }
  const surfaces = Object.fromEntries(
    Object.entries({ root: surfaceLayers.root, board: endingSurfaceLayers.board }).map(([key, layer]) => {
      const latency = surfaceFlinger(context, '--latency', layer);
      return [key, parseSurfaceFlingerLatency(latency)];
    }),
  );
  return {
    frames: parseGfxInfoFrames(gfxInfo),
    surfaces,
    surfaceLayers: { start: surfaceLayers, end: endingSurfaceLayers },
    driverTiming,
  };
}

function levelTapChunks(level, bounds) {
  const points = level.taps.map(({ row, col }) =>
    cellCenter(bounds, row, col, level.rows, level.cols));
  const chunks = chunkTapPoints(points);
  if (chunks.length < 1 || chunks.at(-1).length > 3) {
    throw new Error(`Level ${level.levelIndex} did not reserve a bounded final tap chunk`);
  }
  return chunks;
}

function clearLevelAndAdvance(context, finalPoints, nextLevelIndex) {
  const clearTiming = runTapSequence(context, finalPoints);
  const nextButton = waitForTextBounds(context, 'Next level');
  // The overlay appears 450 ms after the clear. Keep it mounted long enough
  // for the final 590 ms star delay and spring/audio tail before advancing.
  delay(SOAK_WIN_FEEDBACK_SETTLE_MS);
  const nextTiming = tapBounds(context, nextButton);
  waitForUiText(context, `LEVEL ${nextLevelIndex + 1}`);
  const nextBounds = findBoardBounds(context);
  delay(220); // include the board's 180 ms entrance fade before the next solve
  return { clearTiming, nextTiming, nextBounds };
}

function runWarmupLevel(context, level) {
  log(`soak warmup: level ${level.displayedLevel} (${level.arrowCount} arrows)`);
  waitForLevelReady(context, level);
  const bounds = findBoardBounds(context);
  const chunks = levelTapChunks(level, bounds);
  for (const chunk of chunks.slice(0, -1)) {
    runTapSequence(context, chunk);
    delay(SOAK_CLEANUP_WINDOW_MS);
  }
  const timing = clearLevelAndAdvance(context, chunks.at(-1), level.levelIndex + 1);
  delay(SOAK_POST_LEVEL_SETTLE_MS);
  return timing;
}

function runMeasuredSoakLevel(context, level, memoryOnly) {
  log(`soak measured: level ${level.displayedLevel} (${level.arrowCount} arrows)`);
  waitForLevelReady(context, level);
  const bounds = findBoardBounds(context);
  const chunks = levelTapChunks(level, bounds);
  const prefixChunks = chunks.slice(0, -1);
  const finalChunk = chunks.at(-1);
  const beforeSolvePss = memoryOnly ? null : readPssCategories(context);
  const tapActiveFrames = emptyFrameAggregate();
  const cleanupFrames = emptyFrameAggregate();
  const solveDriverTimings = [];

  for (const chunk of prefixChunks) {
    if (memoryOnly) {
      solveDriverTimings.push(runTapSequence(context, chunk));
      delay(SOAK_MEMORY_ONLY_INTER_BATCH_IDLE_MS);
    } else {
      const sample = measureFrameWindow(context, () => runTapSequence(context, chunk));
      appendFrameSample(tapActiveFrames, sample);
      solveDriverTimings.push(sample.driverTiming);
      const cleanupSample = measureFrameWindow(context, () => {
        delay(SOAK_CLEANUP_WINDOW_MS);
        return { kind: 'post-tap-cleanup', durationMs: SOAK_CLEANUP_WINDOW_MS };
      }, 0);
      appendFrameSample(cleanupFrames, cleanupSample);
    }
  }

  const beforeTransitionPss = memoryOnly ? null : readPssCategories(context);
  const transitionFrames = emptyFrameAggregate();
  let transitionTiming;
  if (memoryOnly) {
    transitionTiming = clearLevelAndAdvance(
      context,
      finalChunk,
      level.levelIndex + 1,
    );
    delay(SOAK_POST_LEVEL_SETTLE_MS);
  } else {
    const transitionSample = measureFrameWindow(
      context,
      () => {
        const timing = clearLevelAndAdvance(context, finalChunk, level.levelIndex + 1);
        delay(SOAK_POST_LEVEL_SETTLE_MS);
        return timing;
      },
    );
    appendFrameSample(transitionFrames, transitionSample);
    transitionTiming = transitionSample.driverTiming;
  }
  const solveFrames = emptyFrameAggregate();
  appendFrameAggregate(solveFrames, tapActiveFrames);
  appendFrameAggregate(solveFrames, cleanupFrames);
  const totalFrames = emptyFrameAggregate();
  appendFrameAggregate(totalFrames, solveFrames);
  appendFrameAggregate(totalFrames, transitionFrames);
  const afterTransitionPss = readPssCategories(context);

  return {
    levelIndex: level.levelIndex,
    displayedLevel: level.displayedLevel,
    rows: level.rows,
    cols: level.cols,
    arrowCount: level.arrowCount,
    shapeName: level.shapeName,
    boardChecksum: level.boardChecksum,
    solveChecksum: level.solveChecksum,
    tapBatches: {
      count: chunks.length,
      prefixSizes: prefixChunks.map((chunk) => chunk.length),
      reservedFinalSize: finalChunk.length,
      intervalMs: SOAK_TAP_INTERVAL_MS,
    },
    frames: {
      tapActive: summarizeFrameAggregate(tapActiveFrames),
      postTapCleanup: summarizeFrameAggregate(cleanupFrames),
      solve: summarizeFrameAggregate(solveFrames),
      transition: summarizeFrameAggregate(transitionFrames),
      total: summarizeFrameAggregate(totalFrames),
    },
    driverTiming: {
      solveChunks: solveDriverTimings,
      transition: transitionTiming,
    },
    pss: {
      beforeSolve: beforeSolvePss,
      beforeTransition: beforeTransitionPss,
      afterTransition: afterTransitionPss,
      solveGrowth: memoryOnly
        ? null
        : pssCategoryGrowth([beforeSolvePss, beforeTransitionPss]),
      transitionGrowth: memoryOnly
        ? null
        : pssCategoryGrowth([beforeTransitionPss, afterTransitionPss]),
      levelGrowth: memoryOnly
        ? null
        : pssCategoryGrowth([beforeSolvePss, afterTransitionPss]),
    },
    rawFrames: {
      tapActive: tapActiveFrames,
      postTapCleanup: cleanupFrames,
      solve: solveFrames,
      transition: transitionFrames,
      total: totalFrames,
    },
  };
}

function pssCategoryGrowth(samples) {
  if (samples.length === 0) return {};
  const first = samples[0];
  const last = samples.at(-1);
  return Object.fromEntries(
    Object.keys(first)
      .filter((key) => key.endsWith('Kb'))
      .map((key) => [key.replace(/Kb$/, 'GrowthKb'), last[key] - first[key]]),
  );
}

function writeSoakSnapshot(options, result, print = false) {
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (options.output) {
    mkdirSync(dirname(options.output), { recursive: true });
    writeFileSync(options.output, json);
  }
  if (print || !options.output) process.stdout.write(json);
}

function runSoakBenchmark(context, options, plan, baseResult, configuration) {
  const result = {
    ...baseResult,
    schemaVersion: 4,
    status: 'running',
    benchmark: {
      mode: 'same-process-level-soak',
      warmupLevel: {
        levelIndex: plan.warmup.levelIndex,
        displayedLevel: plan.warmup.displayedLevel,
        arrowCount: plan.warmup.arrowCount,
        boardChecksum: plan.warmup.boardChecksum,
        solveChecksum: plan.warmup.solveChecksum,
      },
      startLevelIndex: plan.startLevelIndex,
      measuredLevelCount: plan.measuredLevelCount,
      endLevelIndex: plan.measured.at(-1).levelIndex,
      measuredArrowCount: plan.measured.reduce((sum, level) => sum + level.arrowCount, 0),
      feedbackEnabled: options.feedback,
      feedbackForcedBySoak: true,
      isolatedWork: ['ads', 'persistence', 'network'],
      ...configuration,
      tapBatchSize: 8,
      reservedFinalTaps: 3,
      tapIntervalMs: SOAK_TAP_INTERVAL_MS,
      soakInstrumentation: options.memoryOnly
        ? 'memory-only-one-pss-sample-per-level'
        : 'frame-windows-and-three-pss-samples-per-level',
      postBatchCleanupWindowMs: SOAK_CLEANUP_WINDOW_MS,
      memoryOnlyInterBatchIdleMs: options.memoryOnly
        ? SOAK_MEMORY_ONLY_INTER_BATCH_IDLE_MS
        : null,
      winFeedbackSettleMs: SOAK_WIN_FEEDBACK_SETTLE_MS,
      finalIdleWindowMs: SOAK_FINAL_IDLE_MS,
      postLevelSettleMs: SOAK_POST_LEVEL_SETTLE_MS,
    },
    process: null,
    pss: { beforeWarmup: null, afterWarmup: null },
    levels: [],
    summary: null,
  };
  let activeLevel = plan.warmup.levelIndex;
  const allLevelFrames = emptyFrameAggregate();
  const allTapActiveFrames = emptyFrameAggregate();
  const allCleanupFrames = emptyFrameAggregate();
  const allTransitionFrames = emptyFrameAggregate();

  try {
    const healthBaseline = createProcessHealthBaseline(context);
    result.process = {
      initialPid: healthBaseline.pid,
      samePid: true,
      baselineExitInfoCount: healthBaseline.exitInfo.size,
    };
    result.pss.beforeWarmup = readPssCategories(context);
    runWarmupLevel(context, plan.warmup);
    assertProcessHealthy(context, healthBaseline);
    result.pss.afterWarmup = readPssCategories(context);
    if (options.output) writeSoakSnapshot(options, result);

    for (const level of plan.measured) {
      activeLevel = level.levelIndex;
      const measurement = runMeasuredSoakLevel(context, level, options.memoryOnly);
      appendFrameAggregate(allLevelFrames, measurement.rawFrames.total);
      appendFrameAggregate(allTapActiveFrames, measurement.rawFrames.tapActive);
      appendFrameAggregate(allCleanupFrames, measurement.rawFrames.postTapCleanup);
      appendFrameAggregate(allTransitionFrames, measurement.rawFrames.transition);
      delete measurement.rawFrames;
      measurement.processHealth = assertProcessHealthy(context, healthBaseline);
      result.levels.push(measurement);
      if (options.output) writeSoakSnapshot(options, result);
    }

    const beforeFinalIdlePss = result.levels.at(-1).pss.afterTransition;
    delay(SOAK_FINAL_IDLE_MS);
    assertProcessHealthy(context, healthBaseline);
    result.pss.afterFinalIdle = readPssCategories(context);

    // The post-warmup sample is the baseline before the first measured solve;
    // each following sample is taken after that measured level's transition.
    const transitionPss = [
      result.pss.afterWarmup,
      ...result.levels.map((level) => level.pss.afterTransition),
    ];
    const totalPssValues = transitionPss.map((sample) => sample.totalPssKb);
    const pssTrend = summarizePssTrend(transitionPss);
    const steadyTotalPssTrend = summarizePssTrend(
      transitionPss.slice(STEADY_STATE_SKIP_SAMPLES),
    );
    const steadyLeakSensitivePssTrend = summarizePssTrend(
      transitionPss.slice(STEADY_STATE_SKIP_SAMPLES),
      ['nativeHeapPssKb', 'privateOtherPssKb'],
    );
    const memoryGrowthDetected =
      steadyTotalPssTrend.monotonicGrowthDetected ||
      steadyLeakSensitivePssTrend.monotonicGrowthDetected;
    result.summary = {
      completedLevels: result.levels.length,
      processStayedAlive: true,
      finalPid: runningPid(context),
      frames: {
        allLevels: summarizeFrameAggregate(allLevelFrames),
        tapActive: summarizeFrameAggregate(allTapActiveFrames),
        postTapCleanup: summarizeFrameAggregate(allCleanupFrames),
        transitions: summarizeFrameAggregate(allTransitionFrames),
      },
      transitionPss: {
        includesPostWarmupBaseline: true,
        ...summarizePss(totalPssValues),
        ...pssTrend,
        categoryGrowth: pssCategoryGrowth(transitionPss),
        memoryGate: {
          skippedInitialSamples: STEADY_STATE_SKIP_SAMPLES,
          totalPss: steadyTotalPssTrend,
          leakSensitivePss: steadyLeakSensitivePssTrend,
          passed: !memoryGrowthDetected,
        },
        finalIdleReclamation: pssCategoryGrowth([
          beforeFinalIdlePss,
          result.pss.afterFinalIdle,
        ]),
      },
    };
    result.summary.performanceGate = options.memoryOnly
      ? null
      : evaluatePerformanceGate(
        result.summary.frames.tapActive,
        result.levels.map((level) => level.frames.tapActive),
        SOAK_PERFORMANCE_BUDGETS,
      );
    const afterThermal = thermalStatus(context.adbExecutable, context.serial);
    result.environment.thermalStatusAfter = afterThermal;
    if (afterThermal > 0) {
      throw new Error(`Device throttled during soak benchmark (status ${afterThermal})`);
    }
    if (memoryGrowthDetected) {
      const failedMetrics = [
        steadyTotalPssTrend.monotonicGrowthDetected ? 'total PSS' : null,
        steadyLeakSensitivePssTrend.monotonicGrowthDetected
          ? 'native heap + private other PSS'
          : null,
      ].filter(Boolean).join(' and ');
      throw new Error(
        `Sustained steady-state growth exceeded 10 MiB in ${failedMetrics} ` +
        `(after skipping ${STEADY_STATE_SKIP_SAMPLES} warm-up samples)`,
      );
    }
    if (result.summary.performanceGate && !result.summary.performanceGate.passed) {
      const failedMetrics = Object.entries(result.summary.performanceGate.checks)
        .filter(([, passed]) => !passed)
        .map(([metric]) => metric)
        .join(', ');
      throw new Error(`Soak frame budget failed: ${failedMetrics}`);
    }
    result.status = 'passed';
    return result;
  } catch (error) {
    if (result.process) {
      result.process.samePid = tryCapture(context.adbExecutable, [
        '-s', context.serial, 'shell', 'pidof', APPLICATION_ID,
      ]) === String(result.process.initialPid);
    }
    result.status = 'failed';
    result.failure = {
      levelIndex: activeLevel,
      completedLevels: result.levels.length,
      message: error.message,
      stack: error.stack,
    };
    writeSoakSnapshot(options, result, !options.output);
    throw error;
  }
}

function captureScreenshot(context, outputPath) {
  startReady(context);
  const result = spawnSync(context.adbExecutable, [
    '-s', context.serial, 'exec-out', 'screencap', '-p',
  ], { encoding: null, timeout: 30_000, maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`screencap failed (${result.status})`);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, result.stdout);
  log(`wrote screenshot ${outputPath}`);
}

function thermalStatus(adbExecutable, serial) {
  const output = adb(adbExecutable, serial, ['shell', 'dumpsys', 'thermalservice']);
  return Number(output.match(/Thermal Status:\s*(\d+)/)?.[1] ?? -1);
}

function gpuRenderer(adbExecutable, serial) {
  const output = adb(adbExecutable, serial, ['shell', 'dumpsys', 'SurfaceFlinger']);
  return output.match(/^GLES:\s*(.+)$/m)?.[1]?.trim() ?? 'unknown';
}

function gitMetadata() {
  return {
    head: tryCapture('git', ['rev-parse', 'HEAD'], { cwd: PROJECT_ROOT }),
    branch: tryCapture('git', ['branch', '--show-current'], { cwd: PROJECT_ROOT }),
    dirty: Boolean(tryCapture('git', ['status', '--short'], { cwd: PROJECT_ROOT })),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const soakPlan = options.soakLevels === null ? null : createSoakPlan(options);
  const singleLevelPlan = soakPlan === null ? createSingleLevelPlan() : null;
  const configuration = benchmarkConfiguration(options);
  const sdkRoot = resolveAndroidSdkRoot();
  const tempRoot = mkdtempSync(join(tmpdir(), 'arrows-perf-android-'));

  try {
    const adbExecutable = validateDevice(sdkRoot, options);
    const beforeThermal = thermalStatus(adbExecutable, options.serial);
    if (beforeThermal > 0) throw new Error(`Device is thermally throttled (status ${beforeThermal})`);

    const apk = buildRelease(options);
    const apkMetadata = validateApk(apk, sdkRoot);
    log(`installing ${basename(apk)}`);
    adb(adbExecutable, options.serial, ['install', '-r', '-t', apk], { timeout: 180_000 });
    adb(adbExecutable, options.serial, ['shell', 'pm', 'clear', APPLICATION_ID]);
    adb(adbExecutable, options.serial, [
      'shell', 'cmd', 'package', 'compile', '-m', 'speed', '-f', APPLICATION_ID,
    ], { timeout: 180_000 });

    const installed = adb(adbExecutable, options.serial, ['shell', 'dumpsys', 'package', APPLICATION_ID]);
    if (/\bDEBUGGABLE\b/.test(installed)) throw new Error('Installed package is debuggable');

    const localJar = buildInputDriver({
      sdkRoot,
      apiLevel: options.api,
      outputDir: join(tempRoot, 'input-driver'),
    });
    const remoteJar = '/data/local/tmp/arrows-perf-input.jar';
    adb(adbExecutable, options.serial, ['push', localJar, remoteJar]);

    const context = {
      adbExecutable,
      serial: options.serial,
      activity: resolveActivity(adbExecutable, options.serial),
      remoteJar,
      displayHeight: physicalDisplayHeight(adbExecutable, options.serial),
    };
    startReady(context);
    const installedSurfaceLayers = resolveSurfaceLayers(context);
    const installedSurfaceKind = installedSurfaceLayers.surfaceView ? 'surfaceView' : 'rootWindow';
    if (options.expectSurface && installedSurfaceKind !== options.expectSurface) {
      throw new Error(
        `Expected ${options.expectSurface}, but installed APK uses ${installedSurfaceKind}`,
      );
    }
    if (singleLevelPlan !== null) validateWorkload(context, singleLevelPlan);
    if (options.screenshot) captureScreenshot(context, options.screenshot);

    if (soakPlan !== null) {
      const baseResult = {
        label: options.label,
        timestamp: new Date().toISOString(),
        environment: {
          serial: options.serial,
          avd: options.avd,
          apiLevel: options.api,
          refreshRateHz: 60,
          abi: adb(adbExecutable, options.serial, ['shell', 'getprop', 'ro.product.cpu.abi']),
          model: adb(adbExecutable, options.serial, ['shell', 'getprop', 'ro.product.model']),
          gpuRenderer: gpuRenderer(adbExecutable, options.serial),
          boardSurfaceKind: installedSurfaceKind,
          thermalStatusBefore: beforeThermal,
          thermalStatusAfter: null,
          apk: apkMetadata,
          git: gitMetadata(),
        },
      };
      const result = runSoakBenchmark(context, options, soakPlan, baseResult, configuration);
      writeSoakSnapshot(options, result, true);
      if (options.output) log(`wrote ${options.output}`);
      return;
    }

    for (let warmup = 1; warmup <= options.warmups; warmup += 1) {
      log(`warmup ${warmup}/${options.warmups}`);
      for (const phase of options.phases) {
        const bounds = startReady(context);
        prepareWorkload(context, phase, bounds, singleLevelPlan);
        runWorkload(context, phase, bounds, singleLevelPlan);
      }
    }

    const measurements = [];
    const framesByPhase = Object.fromEntries(options.phases.map((phase) => [phase, []]));
    const surfaceFramesByPhase = Object.fromEntries(options.phases.map((phase) => [phase, []]));
    const rootSurfaceFramesByPhase = Object.fromEntries(options.phases.map((phase) => [phase, []]));
    const allFrames = [];
    const allSurfaceFrames = [];
    const allRootSurfaceFrames = [];
    const pssValues = [];
    for (let run = 1; run <= options.runs; run += 1) {
      const phases = {};
      for (const phase of options.phases) {
        log(`run ${run}/${options.runs}: ${phase}`);
        const sample = measurePhase(context, phase, singleLevelPlan);
        framesByPhase[phase].push(...sample.frames);
        surfaceFramesByPhase[phase].push(...sample.surfaces.board.frames);
        rootSurfaceFramesByPhase[phase].push(...sample.surfaces.root.frames);
        allFrames.push(...sample.frames);
        allSurfaceFrames.push(...sample.surfaces.board.frames);
        allRootSurfaceFrames.push(...sample.surfaces.root.frames);
        pssValues.push(sample.pssKb);
        const boardSurface = summarizeSurfaceFrames(
          sample.surfaces.board.frames,
          sample.surfaces.board.refreshPeriodMs,
        );
        const rootSurface = summarizeSurfaceFrames(
          sample.surfaces.root.frames,
          sample.surfaces.root.refreshPeriodMs,
        );
        phases[phase] = {
          ...summarizeOptionalGfxFrames(sample.frames),
          ...boardSurface,
          surfaceLayer: sample.surfaceLayers.board,
          surfaceKind: sample.surfaceLayers.surfaceView ? 'surfaceView' : 'rootWindow',
          rootSurface: {
            ...rootSurface,
            surfaceLayer: sample.surfaceLayers.root,
          },
          driverTiming: sample.driverTiming,
          pssKb: sample.pssKb,
        };
      }
      measurements.push({ run, phases });
    }

    const afterThermal = thermalStatus(adbExecutable, options.serial);
    if (afterThermal > 0) throw new Error(`Device throttled during benchmark (status ${afterThermal})`);
    const phaseSummary = Object.fromEntries(
      options.phases.map((phase) => [phase, {
        ...summarizeOptionalGfxFrames(framesByPhase[phase]),
        ...summarizeSurfaceFrames(surfaceFramesByPhase[phase]),
        rootSurface: summarizeSurfaceFrames(rootSurfaceFramesByPhase[phase]),
      }]),
    );
    const result = {
      schemaVersion: 2,
      label: options.label,
      timestamp: new Date().toISOString(),
      benchmark: {
        levelIndex: FIXED_LEVEL,
        displayedLevel: FIXED_LEVEL + 1,
        rows: 39,
        cols: 39,
        arrowCount: 250,
        checksum: 'b1f50ecb',
        warmups: options.warmups,
        measuredRuns: options.runs,
        phases: options.phases,
        feedbackEnabled: options.feedback,
        ...configuration,
        exitTrailPhaseStartingArrowCount: EXIT_PHASE_STARTING_ARROW_COUNT,
      },
      environment: {
        serial: options.serial,
        avd: options.avd,
        apiLevel: options.api,
        refreshRateHz: 60,
        abi: adb(adbExecutable, options.serial, ['shell', 'getprop', 'ro.product.cpu.abi']),
        model: adb(adbExecutable, options.serial, ['shell', 'getprop', 'ro.product.model']),
        gpuRenderer: gpuRenderer(adbExecutable, options.serial),
        boardSurfaceKind: installedSurfaceKind,
        thermalStatusBefore: beforeThermal,
        thermalStatusAfter: afterThermal,
        apk: apkMetadata,
        git: gitMetadata(),
      },
      measurements,
      summary: {
        ...summarizeOptionalGfxFrames(allFrames),
        ...summarizeSurfaceFrames(allSurfaceFrames),
        rootSurface: summarizeSurfaceFrames(allRootSurfaceFrames),
        ...summarizePss(pssValues),
        phases: phaseSummary,
      },
    };

    const json = `${JSON.stringify(result, null, 2)}\n`;
    if (options.output) {
      mkdirSync(dirname(options.output), { recursive: true });
      writeFileSync(options.output, json);
      log(`wrote ${options.output}`);
    }
    process.stdout.write(json);
  } finally {
    if (tempRoot.startsWith(join(tmpdir(), 'arrows-perf-android-'))) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
