import {
  ArrowsFeedback,
  type FeedbackEvent,
} from '../../modules/arrows-feedback';

/** Preloads native audio only while audible gameplay is mounted. */
export function prepareFeedback(soundOn: boolean): void {
  if (!ArrowsFeedback) return;
  try {
    ArrowsFeedback.prepare(soundOn);
  } catch {
    // Feedback is decorative. A native audio failure must not stop play.
  }
}

/** Frees reusable native feedback resources when gameplay unmounts. */
export function releaseFeedback(): void {
  if (!ArrowsFeedback) return;
  try {
    ArrowsFeedback.release();
  } catch {
    // Teardown is best-effort and must stay invisible to gameplay.
  }
}

/** One synchronous native call per gameplay beat; no Promise allocation. */
export function feedback(event: FeedbackEvent, soundOn: boolean, step = 0): void {
  if (ArrowsFeedback) {
    try {
      ArrowsFeedback.feedback(event, soundOn, step);
    } catch {
      // Do not fall through to a second audio stack after a native failure.
    }
    return;
  }

  // Expo Go cannot contain local native modules. Keep it functional there
  // without evaluating Expo Audio in installed builds.
  try {
    const fallback = require('./feedbackFallback') as typeof import('./feedbackFallback');
    fallback.feedback(event, soundOn, step);
  } catch {
    // Feedback remains decorative when an optional fallback is unavailable.
  }
}
