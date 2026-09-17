import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MOTION_SCALE_KEYS,
  assertAppReducedMotionMatches,
  motionEnvironment,
  parseMotionScale,
  parseReducedMotionLabel,
  parseReducedMotionLog,
  parseScaleReadBack,
} from './device.mjs';

test('the three global scale keys are the ones Android and Reanimated read', () => {
  assert.deepEqual(MOTION_SCALE_KEYS, {
    windowAnimationScale: 'window_animation_scale',
    transitionAnimationScale: 'transition_animation_scale',
    animatorDurationScale: 'animator_duration_scale',
  });
});

test('--motion-scale accepts exactly 0 or 1', () => {
  assert.equal(parseMotionScale('0'), 0);
  assert.equal(parseMotionScale('1'), 1);
  for (const bad of ['0.5', '2', '', 'one', undefined]) {
    assert.throws(() => parseMotionScale(bad), /--motion-scale must be 0 or 1/);
  }
});

test('settings read-back parses numbers and keeps unset keys as null', () => {
  assert.deepEqual(
    parseScaleReadBack({ windowAnimationScale: '1.0', transitionAnimationScale: '0', animatorDurationScale: 'null' }),
    { windowAnimationScale: 1, transitionAnimationScale: 0, animatorDurationScale: null },
  );
});

test('the recorded scales are the read-back values, never the request', () => {
  const env = motionEnvironment({
    requestedScale: 0,
    readBack: { windowAnimationScale: 1, transitionAnimationScale: 1, animatorDurationScale: 1 },
    appReducedMotion: false,
  });
  assert.equal(env.windowAnimationScale, 1);
  assert.equal(env.transitionAnimationScale, 1);
  assert.equal(env.animatorDurationScale, 1);
  assert.equal(env.relaunchedAfterScaleChange, true);
  assert.equal(env.appReducedMotion, false);
  assert.ok(!('reducedMotionVariantMeasured' in env));
  assert.ok(!('requestedMotionScale' in env), 'the request is not written into environment');
});

test('reducedMotionVariantMeasured is stamped whenever the app reports reduced motion', () => {
  const env = motionEnvironment({
    requestedScale: 0,
    readBack: { windowAnimationScale: 0, transitionAnimationScale: 0, animatorDurationScale: 0 },
    appReducedMotion: true,
  });
  assert.equal(env.reducedMotionVariantMeasured, true);
});

test('an unavailable app value falls back to the setting Reanimated reads', () => {
  const unavailable = 'unavailable: non-PERF build';
  const zero = motionEnvironment({
    requestedScale: 0,
    readBack: { windowAnimationScale: 0, transitionAnimationScale: 0, animatorDurationScale: 0 },
    appReducedMotion: unavailable,
  });
  assert.equal(zero.appReducedMotion, unavailable);
  assert.equal(zero.reducedMotionVariantMeasured, true);
  const one = motionEnvironment({
    requestedScale: 1,
    readBack: { windowAnimationScale: 1, transitionAnimationScale: 1, animatorDurationScale: 1 },
    appReducedMotion: unavailable,
  });
  assert.ok(!('reducedMotionVariantMeasured' in one));
});

test('a stale app value (launched before the scale change) aborts', () => {
  assert.throws(
    () => assertAppReducedMotionMatches({ transitionAnimationScale: 1 }, true),
    /appReducedMotion=true.*transition_animation_scale=1/,
  );
  assert.throws(
    () => assertAppReducedMotionMatches({ transitionAnimationScale: 0 }, false),
    /appReducedMotion=false.*transition_animation_scale=0/,
  );
  assert.doesNotThrow(() => assertAppReducedMotionMatches({ transitionAnimationScale: 0 }, true));
  assert.doesNotThrow(() => assertAppReducedMotionMatches({ transitionAnimationScale: 1 }, false));
  assert.doesNotThrow(() => assertAppReducedMotionMatches({ transitionAnimationScale: 1 }, 'unavailable: non-PERF build'));
});

test('the app label is read from a uiautomator dump', () => {
  const node = (desc) =>
    `<node index="0" text="" resource-id="" class="android.view.ViewGroup" content-desc="${desc}" bounds="[0,0][1440,3120]">`;
  assert.equal(parseReducedMotionLabel(`<hierarchy>${node('perf-reduced-motion-1')}</hierarchy>`), true);
  assert.equal(parseReducedMotionLabel(`<hierarchy>${node('perf-reduced-motion-0')}</hierarchy>`), false);
  assert.equal(parseReducedMotionLabel(`<hierarchy>${node('Play')}</hierarchy>`), null);
});

test('the app value is read from the diagnostic logcat line, newest wins', () => {
  const log = [
    '09-17 04:39:47.803  8412  8435 I ReactNativeJS: Running "main"',
    '09-17 04:39:47.900  8412  8435 I ReactNativeJS: [capture-diag] perf-reduced-motion-0 screen=splash',
    '09-17 04:39:50.900  8412  8435 I ReactNativeJS: [capture-diag] perf-reduced-motion-1 screen=menu',
  ].join('\n');
  assert.equal(parseReducedMotionLog(log), true);
  assert.equal(parseReducedMotionLog('I ReactNativeJS: Running "main"'), null);
});
