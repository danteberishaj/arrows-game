import {
  blockedBumpAt,
  blockerOpacityAt,
  blockerStrokeSwellAt,
  PRESSED_STROKE_SWELL,
} from '../feedbackCurves';

describe('blockedBumpAt', () => {
  it('starts and ends at rest, peaks early at about a fifth of a cell', () => {
    expect(blockedBumpAt(0)).toBeCloseTo(0);
    expect(blockedBumpAt(1)).toBeCloseTo(0, 5);
    let peakK = 0, peak = 0;
    for (let k = 0; k <= 1; k += 0.01) {
      const d = blockedBumpAt(k);
      expect(d).toBeGreaterThanOrEqual(0); // never recoils past rest
      if (d > peak) { peak = d; peakK = k; }
    }
    expect(peak).toBeGreaterThan(0.18);
    expect(peak).toBeLessThan(0.28);
    expect(peakK).toBeGreaterThan(0.2);
    expect(peakK).toBeLessThan(0.4);
    expect(blockedBumpAt(-1)).toBeCloseTo(0);
    expect(blockedBumpAt(2)).toBeCloseTo(0, 5);
  });
});

describe('blocker flash curves', () => {
  it('holds solid then fades out, and relaxes the swell to the resting stroke', () => {
    expect(blockerOpacityAt(0)).toBe(1);
    expect(blockerOpacityAt(0.39)).toBe(1);
    expect(blockerOpacityAt(0.7)).toBeGreaterThan(0);
    expect(blockerOpacityAt(0.7)).toBeLessThan(1);
    expect(blockerOpacityAt(1)).toBeCloseTo(0);
    expect(blockerStrokeSwellAt(0)).toBeCloseTo(1.6);
    expect(blockerStrokeSwellAt(1)).toBeCloseTo(1);
    expect(PRESSED_STROKE_SWELL).toBeGreaterThan(1);
  });
});
