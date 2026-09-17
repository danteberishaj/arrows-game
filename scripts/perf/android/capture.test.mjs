import assert from 'node:assert/strict';
import test from 'node:test';
import { frameStats, parseCaptureArgs, readCalibrationBlock } from './capture.mjs';

test('--motion-scale is required: a capture never inherits the device state silently', () => {
  assert.throws(() => parseCaptureArgs(['--shot', 'menu']), /--motion-scale is required/);
  assert.equal(parseCaptureArgs(['--shot', 'menu', '--motion-scale', '1']).motionScale, 1);
  assert.throws(() => parseCaptureArgs(['--shot', 'menu', '--motion-scale', '0.5']), /0 or 1/);
});

test('exactly one of --shot or --record, and --record needs --seconds', () => {
  assert.throws(() => parseCaptureArgs(['--motion-scale', '0']), /--shot <label> or --record <label>/);
  assert.throws(
    () => parseCaptureArgs(['--motion-scale', '0', '--shot', 'a', '--record', 'b', '--seconds', '2']),
    /--shot <label> or --record <label>/,
  );
  assert.throws(() => parseCaptureArgs(['--motion-scale', '0', '--record', 'b']), /--seconds/);
  assert.throws(() => parseCaptureArgs(['--motion-scale', '0', '--record', 'b', '--seconds', '0']), /--seconds/);
  const record = parseCaptureArgs(['--motion-scale', '0', '--record', 'b', '--seconds', '3', '--frames']);
  assert.equal(record.kind, 'record');
  assert.equal(record.label, 'b');
  assert.equal(record.seconds, 3);
  assert.equal(record.frames, true);
  assert.throws(() => parseCaptureArgs(['--motion-scale', '0', '--shot', 'a', '--frames']), /--frames needs --record/);
});

test('labels are safe directory names', () => {
  assert.throws(() => parseCaptureArgs(['--motion-scale', '0', '--shot', '../x']), /label/);
  assert.throws(() => parseCaptureArgs(['--motion-scale', '0', '--shot', 'a b']), /label/);
});

test('wm size and density are validated', () => {
  const options = parseCaptureArgs([
    '--motion-scale', '0', '--shot', 'menu', '--wm-size', '1080x1920', '--wm-density', '480',
  ]);
  assert.equal(options.wmSize, '1080x1920');
  assert.equal(options.wmDensity, 480);
  assert.throws(() => parseCaptureArgs(['--motion-scale', '0', '--shot', 'a', '--wm-size', '1080']), /WxH/);
  assert.throws(() => parseCaptureArgs(['--motion-scale', '0', '--shot', 'a', '--wm-density', 'x']), /dpi/);
});

test('scripted steps are the PERF phases only; build env entries are recorded verbatim', () => {
  assert.equal(parseCaptureArgs(['--motion-scale', '1', '--shot', 'a', '--step', 'blocked']).step, 'blocked');
  for (const step of ['exit', 'won', 'lost']) {
    assert.equal(parseCaptureArgs(['--motion-scale', '1', '--shot', 'a', '--step', step]).step, step);
  }
  assert.throws(() => parseCaptureArgs(['--motion-scale', '1', '--shot', 'a', '--step', 'swipe']), /--step/);
  const env = parseCaptureArgs([
    '--motion-scale', '1', '--shot', 'a',
    '--build-env', 'EXPO_PUBLIC_CAPTURE_DIAG=1', '--build-env', 'EXPO_PUBLIC_META_X=1',
  ]).buildEnv;
  assert.deepEqual(env, { EXPO_PUBLIC_CAPTURE_DIAG: '1', EXPO_PUBLIC_META_X: '1' });
  assert.throws(() => parseCaptureArgs(['--motion-scale', '1', '--shot', 'a', '--build-env', 'NOPE']), /KEY=VALUE/);
});

test('the calibration block is read from the calibration doc', () => {
  const doc = [
    '# Calibration',
    'text',
    '<!-- capture-calibration:begin -->',
    '```json',
    '{ "tapHold": { "medianMs": 36 }, "recorderFramePeriod": { "medianMs": 16.7 } }',
    '```',
    '<!-- capture-calibration:end -->',
  ].join('\n');
  assert.deepEqual(readCalibrationBlock(doc), {
    tapHold: { medianMs: 36 },
    recorderFramePeriod: { medianMs: 16.7 },
  });
  assert.equal(readCalibrationBlock('# no block'), null);
});

test('frame stats report count and min/median/max inter-frame periods', () => {
  assert.deepEqual(frameStats([0, 0.016, 0.034, 0.05, 0.2]), {
    frameCount: 5,
    periodCount: 4,
    minPeriodMs: 16,
    medianPeriodMs: 17,
    maxPeriodMs: 150,
  });
  assert.deepEqual(frameStats([0]), {
    frameCount: 1, periodCount: 0, minPeriodMs: null, medianPeriodMs: null, maxPeriodMs: null,
  });
});
