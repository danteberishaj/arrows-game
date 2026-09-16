import {
  blockedBumpAt,
  blockedFlashMixAt,
  blockerOpacityAt,
  blockerStrokeSwellAt,
  HINT_STROKE_PEAK_SWELL,
  hintStrokeSwellAt,
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
    expect(blockerOpacityAt(0, false)).toBe(1);
    expect(blockerOpacityAt(0.39, false)).toBe(1);
    expect(blockerOpacityAt(0.7, false)).toBeGreaterThan(0);
    expect(blockerOpacityAt(0.7, false)).toBeLessThan(1);
    // Regression anchor for the shipped motion curve: fully faded at the end.
    expect(blockerOpacityAt(1, false)).toBeCloseTo(0);
    expect(blockerStrokeSwellAt(0, false)).toBeCloseTo(1.6);
    expect(blockerStrokeSwellAt(1, false)).toBeCloseTo(1);
    expect(PRESSED_STROKE_SWELL).toBeGreaterThan(1);
  });
});

// Under OS reduce motion Reanimated jumps every withTiming straight to k = 1, so the
// render code must not depend on k: each curve returns a static, information-carrying value.
const SAMPLE_KS = [0, 0.25, 0.5, 0.75, 1];
const ALL_KS = [...SAMPLE_KS, -1, 2];

describe('reduced motion: static equivalents', () => {
  it.each(ALL_KS)('k=%p: blocker is solid at the flash-onset swell', (k) => {
    expect(blockerOpacityAt(k, true)).toBe(1);
    expect(blockerStrokeSwellAt(k, true)).toBeCloseTo(1.6);
    expect(blockerStrokeSwellAt(k, true)).toBe(blockerStrokeSwellAt(0, false));
  });

  it.each(ALL_KS)('k=%p: blocked arrow stays pure heart (mix 0)', (k) => {
    expect(blockedFlashMixAt(k, true)).toBe(0);
  });

  it.each(ALL_KS)('k=%p: hint holds the pulse peak stroke', (k) => {
    expect(hintStrokeSwellAt(k, true)).toBe(HINT_STROKE_PEAK_SWELL);
  });

  it('the exported hint peak is the shipped 1 + 0.45 pulse peak', () => {
    expect(HINT_STROKE_PEAK_SWELL).toBeCloseTo(1.45, 10);
  });
});

describe('motion on: extracted curves reproduce the old inline maths', () => {
  it.each(SAMPLE_KS)('k=%p: blocked flash mix is 1-(1-k)^2', (k) => {
    const oldInline = 1 - (1 - k) * (1 - k);
    expect(blockedFlashMixAt(k, false)).toBeCloseTo(oldInline, 12);
  });

  it('blocked flash mix clamps out-of-range progress', () => {
    expect(blockedFlashMixAt(-1, false)).toBe(0);
    expect(blockedFlashMixAt(2, false)).toBe(1);
  });

  it.each(SAMPLE_KS)('k=%p: hint swell is 1 + 0.45 * |sin(4πk)| * (1 - 0.6k)', (k) => {
    const pulse = Math.abs(Math.sin(k * Math.PI * 4)) * (1 - k * 0.6);
    expect(hintStrokeSwellAt(k, false)).toBeCloseTo(1 + 0.45 * pulse, 12);
  });

  it('hint swell still pulses (not constant) with motion on', () => {
    expect(hintStrokeSwellAt(0, false)).toBeCloseTo(1, 12);
    expect(hintStrokeSwellAt(0.125, false)).toBeGreaterThan(1.4);
  });
});
