import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseSurfaceFlingerLatency,
  summarizeSurfaceFrames,
} from './parse-surfaceflinger.mjs';

test('parses all timestamp columns, keeps on-time rows, sorts, and de-duplicates', () => {
  const text = [
    '16666666',
    '17000000 37000000 30000000',
    '10000000 9000000 8000000',
    '0 0 0',
    '17000000 37000000 30000000',
    '40000000 9223372036854775807 40000000',
  ].join('\n');

  const parsed = parseSurfaceFlingerLatency(text);
  assert.equal(parsed.refreshPeriodNs, '16666666');
  assert.equal(parsed.refreshPeriodMs, 16.666666);
  assert.equal(parsed.rawFrameCount, 3);
  assert.deepEqual(parsed.frames, [
    {
      desiredToPresentMs: -1,
      desiredToReadyMs: -2,
      readyToPresentMs: 1,
      presentedAtNs: '9000000',
      presentIntervalMs: null,
    },
    {
      desiredToPresentMs: 20,
      desiredToReadyMs: 13,
      readyToPresentMs: 7,
      presentedAtNs: '37000000',
      presentIntervalMs: 28,
    },
  ]);
});

test('clips rows exactly to a monotonic driver window', () => {
  const parsed = parseSurfaceFlingerLatency([
    '10000000',
    '1 70000000 1',
    '1 95000000 1',
    '1 120000000 1',
    '1 151000000 1',
  ].join('\n'), { startNs: '100000000', endNs: '110000000' });

  assert.equal(parsed.rawFrameCount, 4);
  assert.deepEqual(parsed.frames.map((frame) => frame.presentedAtNs), []);
});

test('includes presentation timestamps on both window boundaries', () => {
  const parsed = parseSurfaceFlingerLatency([
    '10000000',
    '1 99999999 1',
    '1 100000000 1',
    '1 110000000 1',
    '1 110000001 1',
  ].join('\n'), { startNs: '100000000', endNs: '110000000' });

  assert.deepEqual(
    parsed.frames.map((frame) => frame.presentedAtNs),
    ['100000000', '110000000'],
  );
});

test('summarizes presentation cadence and missed refresh slots', () => {
  const frames = parseSurfaceFlingerLatency([
    '10000000',
    '1000000 9000000 8000000',
    '11000000 19000000 18000000',
    '21000000 49000000 40000000',
    '51000000 99000000 90000000',
  ].join('\n')).frames;

  assert.deepEqual(summarizeSurfaceFrames(frames, 10), {
    surfaceFrameCount: 4,
    surfacePresentedFps: 3 * 1000 / 90,
    surfacePresentIntervalP50Ms: 30,
    surfacePresentIntervalP95Ms: 50,
    surfacePresentIntervalP99Ms: 50,
    surfacePresentIntervalMaxMs: 50,
    surfaceMissedVsyncCount: 6,
    surfaceMissedVsyncPercent: 6 / 9 * 100,
    surfaceTwoPlusRefreshHitchCount: 2,
    surfaceFourPlusRefreshHitchCount: 1,
    surfaceDesiredToPresentP50Ms: 8,
    surfaceDesiredToPresentP95Ms: 48,
    surfaceDesiredToReadyP95Ms: 39,
    surfaceReadyToPresentP95Ms: 9,
  });
});

test('returns null cadence metrics for an empty surface sample', () => {
  assert.deepEqual(summarizeSurfaceFrames([]), {
    surfaceFrameCount: 0,
    surfacePresentedFps: null,
    surfacePresentIntervalP50Ms: null,
    surfacePresentIntervalP95Ms: null,
    surfacePresentIntervalP99Ms: null,
    surfacePresentIntervalMaxMs: null,
    surfaceMissedVsyncCount: 0,
    surfaceMissedVsyncPercent: null,
    surfaceTwoPlusRefreshHitchCount: 0,
    surfaceFourPlusRefreshHitchCount: 0,
    surfaceDesiredToPresentP50Ms: null,
    surfaceDesiredToPresentP95Ms: null,
    surfaceDesiredToReadyP95Ms: null,
    surfaceReadyToPresentP95Ms: null,
  });
});
