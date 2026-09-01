import { requireOptionalNativeModule } from 'expo';

export type FeedbackEvent = 'exit' | 'blocked' | 'cleared' | 'star';

export interface ArrowsFeedbackNativeModule {
  /** Idempotently creates the pool and starts loading all four short effects. */
  prepare(soundOn: boolean): void;
  /** Releases the pool when gameplay leaves the foreground UI. */
  release(): void;
  /** Plays one effect and its matching haptic without allocating a Promise. */
  feedback(event: FeedbackEvent, soundOn: boolean): void;
}

export const ArrowsFeedback =
  requireOptionalNativeModule<ArrowsFeedbackNativeModule>('ArrowsFeedback');
