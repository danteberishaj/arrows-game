import { requireOptionalNativeModule } from 'expo';

/**
 * 'nudge' is a blocked tap that costs nothing (the arrow was already charged
 * this level): haptic only, no sound.
 */
export type FeedbackEvent = 'exit' | 'blocked' | 'cleared' | 'star' | 'nudge';

export interface ArrowsFeedbackNativeModule {
  /** Idempotently creates the pool and starts loading every short effect. */
  prepare(soundOn: boolean): void;
  /** Releases the pool when gameplay leaves the foreground UI. */
  release(): void;
  /**
   * Plays one effect and its matching haptic without allocating a Promise.
   * `step` is the consecutive-exit ladder position (0..7) and only affects
   * the 'exit' event: it selects the pop's pitch and scales its haptic.
   */
  feedback(event: FeedbackEvent, soundOn: boolean, step: number): void;
  /** WINTER-01 (Android only): start/resume a looping bed from assets/audio, e.g. 'ambience/winter-fireside.m4a'. */
  ambiencePlay?(file: string): void;
  ambienceVolume?(volume: number): void;
  ambiencePause?(): void;
}

export const ArrowsFeedback =
  requireOptionalNativeModule<ArrowsFeedbackNativeModule>('ArrowsFeedback');
