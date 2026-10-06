import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PHASES,
  VALID_PHASES,
  assertTapPlanMatchesArrowCount,
  benchmarkConfiguration,
  createSingleLevelPlan,
  exitStartingArrowCount,
  parseArgs,
  parseGenerationLines,
  perfBuildEnv,
  summarizeGeneration,
  renderedVerdict,
} from './benchmark.mjs';

// DEFAULT_PHASES at da93dcd: [...GESTURE_PHASES, 'blocked', 'exit'].
const DA93DCD_DEFAULT_PHASES = ['zoomIn', 'panHorizontal', 'panVertical', 'zoomOut', 'blocked', 'exit'];

test('default phases are unchanged; splash and menu are opt-in only', () => {
  assert.deepEqual(DEFAULT_PHASES, DA93DCD_DEFAULT_PHASES);
  assert.ok(VALID_PHASES.has('splash'));
  assert.ok(VALID_PHASES.has('menu'));
  assert.deepEqual(parseArgs([], {}).phases, DA93DCD_DEFAULT_PHASES);
});

test('perfScreen defaults to game when EXPO_PUBLIC_PERF_SCREEN is unset', () => {
  assert.equal(parseArgs([], {}).perfScreen, 'game');
  assert.equal(parseArgs(['--phases', 'menu'], { EXPO_PUBLIC_PERF_SCREEN: 'menu' }).perfScreen, 'menu');
  assert.throws(() => parseArgs([], { EXPO_PUBLIC_PERF_SCREEN: 'home' }), /EXPO_PUBLIC_PERF_SCREEN/);
});

test('screen phases need the matching PERF screen, board phases need the game', () => {
  assert.deepEqual(parseArgs(['--phases', 'splash'], { EXPO_PUBLIC_PERF_SCREEN: 'splash' }).phases, ['splash']);
  // A splash or menu build with no --phases measures its own screen.
  assert.deepEqual(parseArgs([], { EXPO_PUBLIC_PERF_SCREEN: 'menu' }).phases, ['menu']);
  assert.throws(() => parseArgs(['--phases', 'menu'], {}), /menu.*EXPO_PUBLIC_PERF_SCREEN=menu/);
  assert.throws(
    () => parseArgs(['--phases', 'blocked'], { EXPO_PUBLIC_PERF_SCREEN: 'menu' }),
    /blocked.*EXPO_PUBLIC_PERF_SCREEN=game/,
  );
});

test('the build env passes EXPO_PUBLIC_PERF_SCREEN through, defaulting to game', () => {
  const options = parseArgs([], {});
  assert.equal(perfBuildEnv(options, {}).EXPO_PUBLIC_PERF_SCREEN, 'game');
  const menu = parseArgs([], { EXPO_PUBLIC_PERF_SCREEN: 'menu' });
  assert.equal(perfBuildEnv(menu, {}).EXPO_PUBLIC_PERF_SCREEN, 'menu');
  // The historical switches are still explicit.
  const env = perfBuildEnv(options, {});
  for (const key of [
    'EXPO_PUBLIC_PERF_LEVEL',
    'EXPO_PUBLIC_PERF_EMPTY_BOARD',
    'EXPO_PUBLIC_PERF_OPAQUE_SURFACE',
    'EXPO_PUBLIC_PERF_NO_EXIT_TRAILS',
    'EXPO_PUBLIC_PERF_EXIT_DURATION_MS',
    'EXPO_PUBLIC_PERF_FEEDBACK',
    'ARROWS_PERF_BUILD',
  ]) {
    assert.ok(key in env, key);
  }
});

test('benchmarkConfiguration records perfScreen for fresh builds and caller APKs alike', () => {
  assert.equal(benchmarkConfiguration(parseArgs([], {})).perfScreen, 'game');
  assert.equal(benchmarkConfiguration(parseArgs(['--skip-build'], {})).perfScreen, 'game');
  assert.equal(
    benchmarkConfiguration(parseArgs(['--skip-build'], { EXPO_PUBLIC_PERF_SCREEN: 'splash' })).perfScreen,
    'splash',
  );
});

test('EXPO_PUBLIC_PERF_MASK_TIMING is forwarded explicitly and recorded (W6-01)', () => {
  const off = parseArgs([], {});
  const on = parseArgs([], { EXPO_PUBLIC_PERF_MASK_TIMING: '1' });
  // Explicit '0' when unset: a value left in the caller's shell cannot leak in.
  assert.equal(perfBuildEnv(off, {}).EXPO_PUBLIC_PERF_MASK_TIMING, '0');
  assert.equal(perfBuildEnv(off, { EXPO_PUBLIC_PERF_MASK_TIMING: '1' }).EXPO_PUBLIC_PERF_MASK_TIMING, '0');
  assert.equal(perfBuildEnv(on, {}).EXPO_PUBLIC_PERF_MASK_TIMING, '1');
  assert.equal(benchmarkConfiguration(off).perfMaskTiming, false);
  assert.equal(benchmarkConfiguration(on).perfMaskTiming, true);
  assert.equal(
    benchmarkConfiguration(parseArgs(['--skip-build'], { EXPO_PUBLIC_PERF_MASK_TIMING: '1' })).perfMaskTiming,
    true,
  );
  // Only the value '1' turns the timer on, matching the app's own check.
  assert.equal(parseArgs([], { EXPO_PUBLIC_PERF_MASK_TIMING: 'true' }).perfMaskTiming, false);
});

test('EXPO_PUBLIC_PERF_TELEMETRY_TIMING is forwarded explicitly and recorded (W6-06)', () => {
  const off = parseArgs([], {});
  const on = parseArgs([], { EXPO_PUBLIC_PERF_TELEMETRY_TIMING: '1' });
  assert.equal(perfBuildEnv(off, {}).EXPO_PUBLIC_PERF_TELEMETRY_TIMING, '0');
  assert.equal(
    perfBuildEnv(off, { EXPO_PUBLIC_PERF_TELEMETRY_TIMING: '1' })
      .EXPO_PUBLIC_PERF_TELEMETRY_TIMING,
    '0',
  );
  assert.equal(perfBuildEnv(on, {}).EXPO_PUBLIC_PERF_TELEMETRY_TIMING, '1');
  assert.equal(benchmarkConfiguration(off).perfTelemetryTiming, false);
  assert.equal(benchmarkConfiguration(on).perfTelemetryTiming, true);
  assert.equal(
    benchmarkConfiguration(
      parseArgs(['--skip-build'], { EXPO_PUBLIC_PERF_TELEMETRY_TIMING: '1' }),
    ).perfTelemetryTiming,
    true,
  );
  assert.equal(
    parseArgs([], { EXPO_PUBLIC_PERF_TELEMETRY_TIMING: 'true' }).perfTelemetryTiming,
    false,
  );
});

test('--motion-scale defaults to 0 so historical runs stay comparable, and accepts only 0 or 1', () => {
  assert.equal(parseArgs([], {}).motionScale, 0);
  assert.equal(parseArgs(['--motion-scale', '1'], {}).motionScale, 1);
  assert.throws(() => parseArgs(['--motion-scale', '0.5'], {}), /--motion-scale must be 0 or 1/);
});

test('B2 diagnostics are explicit flags and default off', () => {
  const plain = parseArgs([], {});
  assert.equal(plain.diagnosticBogusScaleKeys, false);
  assert.equal(plain.diagnosticSkipRelaunch, false);
  const diag = parseArgs(['--diagnostic-bogus-scale-keys', '--diagnostic-skip-relaunch'], {});
  assert.equal(diag.diagnosticBogusScaleKeys, true);
  assert.equal(diag.diagnosticSkipRelaunch, true);
});

test('--record forces a single run and is incompatible with soaks', () => {
  const recorded = parseArgs(['--record', 'exit-scale1', '--runs', '10'], {});
  assert.equal(recorded.record, 'exit-scale1');
  assert.equal(recorded.runs, 1);
  assert.equal(parseArgs([], {}).record, null);
  assert.throws(() => parseArgs(['--record', 'x', '--soak-levels', '20'], {}), /--record/);
  assert.throws(() => parseArgs(['--record', '../x'], {}), /label/);
});

test('--assert-rendered is opt-in and accepts only the phases the gate implements', () => {
  assert.deepEqual(parseArgs([], {}).assertRendered, []);
  assert.deepEqual(parseArgs(['--assert-rendered', 'blocked'], {}).assertRendered, ['blocked']);
  assert.deepEqual(parseArgs(['--assert-rendered', 'blocked,exit'], {}).assertRendered, ['blocked', 'exit']);
  assert.throws(() => parseArgs(['--assert-rendered', 'zoomIn'], {}), /--assert-rendered/);
  assert.throws(
    () => parseArgs(['--assert-rendered', 'blocked', '--phases', 'menu'], { EXPO_PUBLIC_PERF_SCREEN: 'menu' }),
    /--assert-rendered.*game/,
  );
  assert.throws(() => parseArgs(['--assert-rendered', 'exit', '--record', 'x'], {}), /--assert-rendered.*--record/);
});

test('--assert-rendered-blocked-cell selects an in-grid held-out cell only for the blocked gate', () => {
  assert.deepEqual(parseArgs(['--assert-rendered', 'blocked'], {}).assertRenderedBlockedCell, [35, 19]);
  assert.deepEqual(
    parseArgs(['--assert-rendered', 'blocked', '--assert-rendered-blocked-cell', '30,21'], {})
      .assertRenderedBlockedCell,
    [30, 21],
  );
  assert.throws(
    () => parseArgs(['--assert-rendered', 'exit', '--assert-rendered-blocked-cell', '30,21'], {}),
    /--assert-rendered-blocked-cell.*blocked/,
  );
  for (const cell of ['30', '-1,2', '39,2', '2,39']) {
    assert.throws(
      () => parseArgs(['--assert-rendered', 'blocked', '--assert-rendered-blocked-cell', cell], {}),
      /--assert-rendered-blocked-cell/,
    );
  }
});

const FLOORS = {
  blocked: { region: 'board', changedPixelsFloor: 0 },
  exit: { displacementFloorPx: 1, trailPixelsFloor: 0, changedFractionFloor: 0 },
};

test('blocked verdict: changed board pixels must exceed the floor', () => {
  assert.equal(renderedVerdict('blocked', { changedPixels: 0 }, FLOORS).passed, false);
  assert.equal(renderedVerdict('blocked', { changedPixels: 2933 }, FLOORS).passed, true);
});

test('exit verdict: pixels changing without moving fails the moved check (alpha-fade trap)', () => {
  const fade = renderedVerdict('exit', { displacementPx: 0, maxChangedFraction: 0.0011 }, FLOORS);
  assert.equal(fade.passed, false);
  assert.equal(fade.movedPassed, false);
  assert.equal(fade.changedAboveFloor, true);
  const slither = renderedVerdict('exit', { displacementPx: 518.4, maxChangedFraction: 0.0011 }, FLOORS);
  assert.equal(slither.passed, true);
  assert.equal(renderedVerdict('exit', { displacementPx: 1, maxChangedFraction: 0.001 }, FLOORS).passed, false);
});

// W3-15: the single-level workload takes any level and generator version.
test('--level and --gen-version reach the single-level workload; 3827/v1 stays the default', () => {
  const defaults = parseArgs([], {});
  assert.equal(defaults.level, 3827);
  assert.equal(defaults.genVersion, 1);
  const v2 = parseArgs(['--level', '5363', '--gen-version', '2'], {});
  assert.equal(v2.level, 5363);
  assert.equal(v2.genVersion, 2);
  assert.equal(parseArgs(['--level', '0'], {}).level, 0);
  assert.throws(() => parseArgs(['--gen-version', '3'], {}), /--gen-version must be 1 or 2/);
  assert.throws(() => parseArgs(['--level', '-1'], {}), /--level/);
  assert.throws(() => parseArgs(['--level', '1.5'], {}), /--level/);
});

test('the build env deals the requested generator version', () => {
  assert.equal(perfBuildEnv(parseArgs([], {}), {}).EXPO_PUBLIC_PERF_GEN_VERSION, '1');
  const v2 = parseArgs(['--level', '80507', '--gen-version', '2'], {});
  assert.equal(perfBuildEnv(v2, {}).EXPO_PUBLIC_PERF_GEN_VERSION, '2');
  assert.equal(perfBuildEnv(v2, {}).EXPO_PUBLIC_PERF_LEVEL, '80507');
});

test('the single-level plan for index 5363 reads rows 34 and cols 37 from the level', () => {
  const plan = createSingleLevelPlan(parseArgs(['--level', '5363'], {}));
  assert.equal(plan.levelIndex, 5363);
  assert.equal(plan.rows, 34);
  assert.equal(plan.cols, 37);
  assert.equal(plan.taps.length, plan.arrowCount);
  assert.equal(exitStartingArrowCount(plan), Math.min(250, plan.arrowCount));
});

test('the exit phase starts at 250 arrows on the 250-arrow board and at the full board below that', () => {
  assert.equal(exitStartingArrowCount({ arrowCount: 250 }), 250);
  assert.equal(exitStartingArrowCount({ arrowCount: 262 }), 250);
  assert.equal(exitStartingArrowCount({ arrowCount: 194 }), 194);
});

test('a plan whose tap count differs from its arrow count is invalid', () => {
  assert.throws(
    () => assertTapPlanMatchesArrowCount({ levelIndex: 7, arrowCount: 3, taps: [{}, {}] }),
    /invalid.*2 planned taps.*3 arrows/,
  );
  assert.doesNotThrow(() => assertTapPlanMatchesArrowCount({ levelIndex: 7, arrowCount: 2, taps: [{}, {}] }));
});

test('generation lines are parsed and reconciled one per launch against the plan', () => {
  const text = [
    'I/ReactNativeJS( 123): [gen] index=3827 version=1 arrows=250 rows=39 cols=39 ms=81.250',
    'I/ReactNativeJS( 123): unrelated',
    'I/ReactNativeJS( 456): [gen] index=3827 version=1 arrows=250 rows=39 cols=39 ms=79.500',
  ].join('\n');
  const lines = parseGenerationLines(text);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[1], { index: 3827, version: 1, arrows: 250, rows: 39, cols: 39, ms: 79.5 });
  const plan = { levelIndex: 3827, genVersion: 1, arrowCount: 250 };
  const ok = summarizeGeneration({ launches: 2, lines, perLaunchLineCounts: [1, 1] }, plan);
  assert.equal(ok.reconciled, true);
  assert.equal(ok.medianMs, 79.5);
  assert.equal(ok.maxMs, 81.25);
  const missing = summarizeGeneration({ launches: 3, lines, perLaunchLineCounts: [1, 0, 1] }, plan);
  assert.equal(missing.reconciled, false);
  const wrongLevel = summarizeGeneration({ launches: 2, lines, perLaunchLineCounts: [1, 1] }, { ...plan, levelIndex: 5363 });
  assert.equal(wrongLevel.linesMatchingPlan, 0);
  assert.equal(wrongLevel.reconciled, false);
});
