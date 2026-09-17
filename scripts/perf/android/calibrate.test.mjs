import assert from 'node:assert/strict';
import test from 'node:test';
import { calibrationOutputName, DEFAULT_BLOCKED_CELL, parseCalibrateArgs } from './calibrate.mjs';

test('blocked-pairs taps the gate cell (35,19) unless --cell names another one', () => {
  assert.deepEqual(DEFAULT_BLOCKED_CELL, [35, 19]);
  const plain = parseCalibrateArgs(['blocked-pairs', '--set', 'B0', '--motion-scale', '0', '--out', 'x']);
  assert.deepEqual(plain.cell, [35, 19]);
  assert.equal(plain.cellExplicit, false);
  const heldOut = parseCalibrateArgs(['blocked-pairs', '--set', 'B0', '--motion-scale', '0', '--cell', '31,14', '--out', 'x']);
  assert.deepEqual(heldOut.cell, [31, 14]);
  assert.equal(heldOut.cellExplicit, true);
});

test('--cell rejects anything but two non-negative integers', () => {
  for (const bad of ['31', '31,', '31,14,2', 'a,b', '-1,4', '3.5,4']) {
    assert.throws(
      () => parseCalibrateArgs(['blocked-pairs', '--cell', bad, '--out', 'x']),
      /--cell <row,col>/,
      bad,
    );
  }
});

test('a held-out cell never overwrites the gate-cell calibration JSON', () => {
  const gate = parseCalibrateArgs(['blocked-pairs', '--set', 'B0', '--motion-scale', '0', '--out', 'x']);
  const heldOut = parseCalibrateArgs(['blocked-pairs', '--set', 'B0', '--motion-scale', '0', '--cell', '30,21', '--out', 'x']);
  assert.equal(calibrationOutputName(gate), 'blocked-pairs-B0-s0');
  assert.equal(calibrationOutputName(heldOut), 'blocked-pairs-B0-s0-cell30-21');
});

test('the committed blocked floor rejects every measured blackout and passes every measured flash', async () => {
  const { readFileSync } = await import('node:fs');
  const { readCalibrationBlock } = await import('./capture.mjs');
  const { renderedVerdict } = await import('./benchmark.mjs');
  const floors = readCalibrationBlock(
    readFileSync(new URL('../../../docs/perf-capture-calibration.md', import.meta.url), 'utf8'),
  ).renderedFloors;
  // Base da93dcd PERF APK fea8a939, docs/perf-capture-calibration.md "Held-out cells" (calibrate.mjs blocked-pairs).
  const blackouts = { 'B0 (35,19) fitted': 6, 'B0 (31,14) fitted': 14, 'B0 (30,21) held out': 9 };
  const flashes = { 'C (35,19)': 2933, 'C (31,14)': 3075, 'C (30,21)': 5144 };
  for (const [label, changedPixels] of Object.entries(blackouts)) {
    assert.equal(renderedVerdict('blocked', { changedPixels }, floors).passed, false, `${label} ${changedPixels} px must FAIL`);
  }
  for (const [label, changedPixels] of Object.entries(flashes)) {
    assert.equal(renderedVerdict('blocked', { changedPixels }, floors).passed, true, `${label} ${changedPixels} px must PASS`);
  }
});
