import {
  EXIT_TRAIL_CLEANUP_MS,
  EXIT_TRAIL_DURATION_MS,
  EXIT_TRAIL_MAX_DURATION_MS,
  EXIT_TRAIL_STROKE_CELLS,
  MAX_CONCURRENT_EXIT_TRAILS,
  exitAnimationKind,
  exitTrailDurationMs,
} from '../exitAnimationConfig';

describe('exit animation timing', () => {
  it('keeps cleanup close to completion so rapid taps cannot retain many trails', () => {
    expect(EXIT_TRAIL_DURATION_MS).toBeGreaterThanOrEqual(160);
    expect(EXIT_TRAIL_CLEANUP_MS).toBeGreaterThan(EXIT_TRAIL_DURATION_MS);
    expect(EXIT_TRAIL_CLEANUP_MS - EXIT_TRAIL_DURATION_MS).toBeLessThanOrEqual(50);
    expect(MAX_CONCURRENT_EXIT_TRAILS).toBe(2);
    expect(EXIT_TRAIL_STROKE_CELLS).toBeGreaterThan(0);
  });

  it('scales duration with on-screen travel so every level reads at the same speed', () => {
    expect(exitTrailDurationMs(0)).toBe(EXIT_TRAIL_DURATION_MS);
    expect(exitTrailDurationMs(100)).toBe(EXIT_TRAIL_DURATION_MS);
    expect(exitTrailDurationMs(375)).toBeGreaterThan(EXIT_TRAIL_DURATION_MS);
    expect(exitTrailDurationMs(375)).toBeLessThan(EXIT_TRAIL_MAX_DURATION_MS);
    expect(exitTrailDurationMs(5000)).toBe(EXIT_TRAIL_MAX_DURATION_MS);
    expect(exitTrailDurationMs(Number.NaN)).toBe(EXIT_TRAIL_DURATION_MS);
    // Native parsers reject anything outside 160..1000 ms.
    expect(EXIT_TRAIL_MAX_DURATION_MS).toBeLessThanOrEqual(1000);
  });

  it('plays the same slither on native at every density and only diagnostics disable it', () => {
    expect(exitAnimationKind(false, true)).toBe('native-slither');
    expect(exitAnimationKind(false, false)).toBe('slither');
    expect(exitAnimationKind(true, true)).toBe('none');
    expect(exitAnimationKind(true, false)).toBe('none');
  });
});
