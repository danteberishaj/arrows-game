/**
 * W4-11 (META_REVIEW_PROMPT): the timing and plumbing around the store-review
 * ask. The decision is src/core/reviewPolicy.ts; the one call site is
 * GameScreen.tsx (src/ui/__tests__/storePolicyGuard.test.ts pins that).
 *
 * WHEN it fires, relative to the win panel (GameScreen):
 * - The won phase commits WON_PANEL_DELAY_MS (450 ms) after the last arrow
 *   leaves; the panel enters over PANEL_WIN_ENTER_MS (180 ms, settled by
 *   250 ms at the latest via its backstop); its stars start at 250, 420 and
 *   590 ms and spring for a while after.
 * - The ask fires REVIEW_DWELL_MS (2000 ms) after that commit, only if the
 *   player is still looking at the panel: Next / Done, leaving, unmounting or
 *   backgrounding the app first cancels it (no ask, nothing recorded).
 * Why: never during the entrance or the star pop-in (a natural pause, not an
 * interruption; Apple's sample waits "a few seconds" on the completed scene
 * for the same reason), the board is locked behind the panel so no gameplay
 * input can be blocked, and a player who moves on quickly is never asked.
 * GameScreen also skips a campaign clear whose Next would show an
 * interstitial, and Next / Done wait (at most REVIEW_FLOW_WAIT_MAX_MS) for an
 * in-flight flow, so the card never sits over or before an ad or over the
 * next board (Play: "wait until the user has completed the in-app review flow
 * before your app continues its normal user flow").
 */
import { CAPTURE_DIAG } from '../perfMode';

/**
 * Dwell on the committed win panel before asking. Apple's "Requesting App
 * Store reviews" sample pauses 2 s on its completed scene.
 */
export const REVIEW_DWELL_MS = 2000; // OWNER-PICKED STARTING VALUE
/**
 * Longest Next / Done wait for an in-flight review flow. The flow settles when
 * the OS card is dismissed or immediately when nothing is shown; the bound
 * only matters if the store service never answers.
 */
export const REVIEW_FLOW_WAIT_MAX_MS = 3000; // OWNER-PICKED STARTING VALUE

/**
 * At most one ask per app process ("session"), whatever the policy says.
 * Mutable on purpose; only GameScreen sets it (and tests reset it).
 */
export const reviewSession = { asked: false };

export type StoreReviewModule = typeof import('expo-store-review');
let storeReviewModule: StoreReviewModule | null = null;

/**
 * expo-store-review, loaded on first use: with the flag OFF it is never
 * evaluated, so its native module is never looked up. Throws if the native
 * module is missing; the caller's try/catch owns that.
 */
export function loadStoreReview(): StoreReviewModule {
  storeReviewModule ??= require('expo-store-review') as StoreReviewModule;
  return storeReviewModule;
}

/**
 * Resolves when `flow` settles (fulfilled or rejected) or after `maxMs`,
 * whichever comes first; never rejects, and clears its timer.
 */
export function settleWithin(flow: Promise<unknown>, maxMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, maxMs);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    flow.then(done, done);
  });
}

// Looked up per call (tests spy on it). Release builds keep console.log: App's
// `[capture-diag]` line proves it in capture builds (W4-09).
const writeReviewDiag = (line: string) => console.log(line);

/** `__DEV__` read at call time (ruling F10: node-jest imports this module). */
function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
}

/**
 * One `[review] …` logcat line in development and capture
 * (EXPO_PUBLIC_CAPTURE_DIAG=1) builds only; silent in store builds. The W4-11
 * emulator evidence reads these lines.
 */
export function reviewDiag(line: string): void {
  if (!CAPTURE_DIAG && !isDevBuild()) return;
  writeReviewDiag(`[review] ${line}`);
}
