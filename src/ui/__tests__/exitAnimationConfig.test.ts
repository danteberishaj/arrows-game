import {
  DENSE_BOARD_EXIT_THRESHOLD,
  EXIT_TRAIL_CLEANUP_MS,
  EXIT_TRAIL_DURATION_MS,
  MAX_CONCURRENT_EXIT_TRAILS,
  exitAnimationKind,
} from '../exitAnimationConfig';

describe('exit animation timing', () => {
  it('keeps cleanup close to completion so rapid taps cannot retain many trails', () => {
    expect(EXIT_TRAIL_DURATION_MS).toBeGreaterThanOrEqual(160);
    expect(EXIT_TRAIL_CLEANUP_MS).toBeGreaterThan(EXIT_TRAIL_DURATION_MS);
    expect(EXIT_TRAIL_CLEANUP_MS - EXIT_TRAIL_DURATION_MS).toBeLessThanOrEqual(50);
    expect(MAX_CONCURRENT_EXIT_TRAILS).toBe(2);
  });

  it('keeps bounded exit feedback at every board density', () => {
    expect(exitAnimationKind(false, DENSE_BOARD_EXIT_THRESHOLD + 1, true))
      .toBe('native-launch');
    expect(exitAnimationKind(false, DENSE_BOARD_EXIT_THRESHOLD, true))
      .toBe('slither');
    expect(exitAnimationKind(false, DENSE_BOARD_EXIT_THRESHOLD + 1, false))
      .toBe('slither');
    expect(exitAnimationKind(true, DENSE_BOARD_EXIT_THRESHOLD + 1, true))
      .toBe('none');
  });
});
