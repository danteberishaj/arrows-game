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

// ---- W2-09: META_BLOCKED_INK_HOLD (default OFF) ------------------------------
// The flag is read once at module load (EXPO_PUBLIC_* is inlined at build time), so each
// arm loads its own copy of feedbackCurves with the variable set or unset.

type Curves = typeof import('../feedbackCurves');
const INK_HOLD_ENV = 'EXPO_PUBLIC_META_BLOCKED_INK_HOLD';

function loadCurves(inkHold: boolean): Curves {
  const saved = process.env[INK_HOLD_ENV];
  if (inkHold) process.env[INK_HOLD_ENV] = '1';
  else delete process.env[INK_HOLD_ENV];
  let curves: Curves | undefined;
  try {
    jest.isolateModules(() => {
      curves = require('../feedbackCurves') as Curves;
    });
  } finally {
    if (saved === undefined) delete process.env[INK_HOLD_ENV];
    else process.env[INK_HOLD_ENV] = saved;
  }
  return curves as Curves;
}

/** 101 samples, k = 0, 0.01, ..., 1 (computed from integers, so k = 1 is exact). */
const K101 = Array.from({ length: 101 }, (_, i) => i / 100);
const shippedMix = (k: number) => {
  const t = Math.min(1, Math.max(0, k));
  return 1 - (1 - t) * (1 - t);
};

describe('W2-09 flag ON: the magenta holds until the lunge peaks', () => {
  const on = loadCurves(true);

  it('BLOCKED_BUMP_PEAK_K is the argmax of blockedBumpAt (0.001 steps) within 0.005', () => {
    let argmax = 0;
    let peak = -Infinity;
    for (let i = 0; i <= 1000; i += 1) {
      const d = on.blockedBumpAt(i / 1000);
      if (d > peak) { peak = d; argmax = i / 1000; }
    }
    expect(typeof on.BLOCKED_BUMP_PEAK_K).toBe('number');
    expect(Math.abs(on.BLOCKED_BUMP_PEAK_K - argmax)).toBeLessThanOrEqual(0.005);
    // derived, not picked: d/dk [sin(pi k) e^(-2k)] = 0 where tan(pi k) = pi / 2
    expect(Math.tan(Math.PI * on.BLOCKED_BUMP_PEAK_K)).toBeCloseTo(Math.PI / 2, 12);
  });

  it('mix(0) = 0, mix(peak) = 0, mix(1) = 1', () => {
    expect(on.blockedFlashMixAt(0, false)).toBe(0);
    expect(on.blockedFlashMixAt(on.BLOCKED_BUMP_PEAK_K, false)).toBe(0);
    expect(on.blockedFlashMixAt(1, false)).toBe(1);
  });

  it('holds pure heart (0) for every sample up to the peak', () => {
    for (const k of K101.filter((x) => x <= on.BLOCKED_BUMP_PEAK_K)) {
      expect([k, on.blockedFlashMixAt(k, false)]).toEqual([k, 0]);
    }
  });

  it('is monotone non-decreasing over 101 samples', () => {
    for (let i = 1; i < K101.length; i += 1) {
      expect(on.blockedFlashMixAt(K101[i], false)).toBeGreaterThanOrEqual(
        on.blockedFlashMixAt(K101[i - 1], false),
      );
    }
  });

  it('never runs ahead of the shipped curve, and is strictly behind it at k = 0.7', () => {
    for (const k of K101) {
      expect(on.blockedFlashMixAt(k, false)).toBeLessThanOrEqual(shippedMix(k));
    }
    expect(on.blockedFlashMixAt(0.7, false)).toBeLessThan(shippedMix(0.7));
  });

  it('clamps out-of-range progress', () => {
    expect(on.blockedFlashMixAt(-1, false)).toBe(0);
    expect(on.blockedFlashMixAt(2, false)).toBe(1);
  });

  it.each(ALL_KS)('reduced motion, k=%p: unchanged static heart (mix 0)', (k) => {
    expect(on.blockedFlashMixAt(k, true)).toBe(0);
  });
});

describe('W2-09 flag OFF: every curve value is identical to the shipped maths', () => {
  const off = loadCurves(false);
  const on = loadCurves(true);
  const KS = [...K101, -1, 2, 0.3195, 0.123456];

  it('the mix is exactly 1-(1-k)^2 (and 0 under reduced motion)', () => {
    for (const k of KS) {
      expect([k, off.blockedFlashMixAt(k, false)]).toEqual([k, shippedMix(k)]);
      expect([k, off.blockedFlashMixAt(k, true)]).toEqual([k, 0]);
    }
  });

  it('the default build (variable unset) is the OFF curve', () => {
    for (const k of KS) {
      expect([k, blockedFlashMixAt(k, false)]).toEqual([k, off.blockedFlashMixAt(k, false)]);
    }
  });

  it('the flag changes nothing but the motion-on mix', () => {
    expect(on.BLOCKED_BUMP_MS).toBe(off.BLOCKED_BUMP_MS);
    expect(on.BLOCKER_FLASH_MS).toBe(off.BLOCKER_FLASH_MS);
    expect(on.FEEDBACK_CLEANUP_MARGIN_MS).toBe(off.FEEDBACK_CLEANUP_MARGIN_MS);
    expect(on.PRESSED_STROKE_SWELL).toBe(off.PRESSED_STROKE_SWELL);
    expect(on.HINT_STROKE_PEAK_SWELL).toBe(off.HINT_STROKE_PEAK_SWELL);
    for (const k of KS) {
      expect(on.blockedBumpAt(k)).toBe(off.blockedBumpAt(k));
      for (const rm of [false, true]) {
        expect(on.blockerOpacityAt(k, rm)).toBe(off.blockerOpacityAt(k, rm));
        expect(on.blockerStrokeSwellAt(k, rm)).toBe(off.blockerStrokeSwellAt(k, rm));
        expect(on.hintStrokeSwellAt(k, rm)).toBe(off.hintStrokeSwellAt(k, rm));
      }
    }
  });
});
