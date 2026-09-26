/**
 * Build-time feature flags shared by W4, W6 and W7 (ruling I-29). Network and
 * kill gates stay literal; player-visible feature gates use EXPO_PUBLIC_*.
 * Other workstreams keep their own flag modules (ftueConfig.ts, motionFlags.ts,
 * artConfig.ts, generatorVersion.ts); audit all of them before a release.
 */

/**
 * W6-02 remote kill switch for ads and telemetry. OFF: no config request is
 * made and every RemoteConfig getter returns its compiled default ("not
 * killed"), even when kill bits are persisted. W6-03 turns it on together with
 * the hosted config URL, in a release the owner approves.
 */
export const REMOTE_KILL_SWITCH = false;

/**
 * W6-14 first-party telemetry transport. OFF means App keeps the no-op sink,
 * so no event can reach a network request even if another transport gate is
 * accidentally opened. W6-15 owns any future enablement.
 */
export const TELEMETRY_TRANSPORT = false;

/**
 * W4-07 kill constant (literal, ruling F23): invisible shape-collection
 * recording. ON: a campaign clear, a daily clear and the menu-mount fold record
 * solved shapes into `arrows_shapes_seen_lo/_hi` and
 * `arrows_shapes_through_level` (src/core/saveSystem.ts, src/core/collection.ts,
 * src/ui/collectionSync.ts). The only reader is the flagged gallery (W4-09), so
 * nothing on screen changes. OFF stops every collection write; the stored ints
 * sit inert (rollback).
 */
export const COLLECTION_SYNC_ENABLED = true;

/**
 * W7 consent gate. OFF keeps the W6-02 ad-init path unchanged while W7-03's
 * certified CMP source is not available.
 */
export const CONSENT_GATE = process.env.EXPO_PUBLIC_CONSENT_GATE === '1';

/** W4-02 forgiving day streak with free automatic freezes. */
export const META_STREAK_FREEZE = process.env.EXPO_PUBLIC_META_STREAK_FREEZE === '1';

/**
 * Board polish R3: the exit trail runs past the board edge to the screen edge.
 * With it (or META_BOARD_GRID) on, the Android board wrapper stops clipping to
 * the board rectangle so the native view can paint beyond its own bounds.
 */
export const META_EXIT_TO_SCREEN_EDGE = process.env.EXPO_PUBLIC_META_EXIT_TO_SCREEN_EDGE === '1';

/** Board polish R2/R4: dot grid (and "#" line toggle) across the visible screen. */
export const META_BOARD_GRID = process.env.EXPO_PUBLIC_META_BOARD_GRID === '1';

/**
 * Board polish R1/R1a: a level opens zoomed to about 14 cells across the screen
 * width (boards whose fit cell is already >= 23.5 dp open at fit). Pinch-out
 * still reaches the whole board. The Android perf harness assumes the fit camera
 * (scripts/perf/android/soak-utils.mjs cellCenterForBoard), so benchmark with it OFF.
 */
export const META_ZOOMED_CAMERA = process.env.EXPO_PUBLIC_META_ZOOMED_CAMERA === '1';

/**
 * ADMOB-C (ruling M4): an anchored adaptive AdMob banner at the bottom of the
 * MENU only (never on the game screen or during the tutorial). It respects the
 * remote kill switch (all-ads bit) and the consent gate, and takes no space
 * until an ad has loaded.
 */
export const META_BANNER = process.env.EXPO_PUBLIC_META_BANNER === '1';

/**
 * Board polish R6/R6a: an arrow whose blocked tap actually cost a heart stays
 * drawn in a steady deep-rose "missed" mark for the rest of the level (the
 * blocked colour change ends at the mark instead of ink). Android + web; iOS
 * is gated off in missedMarkFlag.ts.
 */
export const META_MISSED_MARK = process.env.EXPO_PUBLIC_META_MISSED_MARK === '1';

/**
 * POLISH-T9 (smoothness audit #7): buttons ease into the press (0.94 over 90 ms)
 * and spring back on release instead of snapping (src/ui/PressScale.tsx). OFF:
 * every button's pressed style is today's, scale snap included.
 */
export const META_PRESS_SPRING = process.env.EXPO_PUBLIC_META_PRESS_SPRING === '1';

/**
 * W2-04: level -> level (Next, Retry) runs under a flat background-coloured
 * scrim: cover 180 ms, swap under full cover, uncover 180 ms
 * (src/ui/scrimTransition.ts, src/ui/ScreenScrim.tsx). OFF: both presses swap
 * the level in one frame, exactly as before.
 */
export const META_LEVEL_TRANSITION = process.env.EXPO_PUBLIC_META_LEVEL_TRANSITION === '1';

/**
 * W2-05: the win and lose panels enter (scrim + panel fade in, panel scales
 * 0.94 -> 1: win 180 ms, loss 260 ms provisional) and the continue-with-ad
 * dismissal fades out (180 ms) instead of vanishing (src/ui/overlayPresence.ts,
 * src/ui/PanelPresence.tsx). OFF: the panel appears and disappears in one
 * frame, exactly as before.
 */
export const META_PANEL_MOTION = process.env.EXPO_PUBLIC_META_PANEL_MOTION === '1';

/**
 * W4-06: "Today's board" under the menu's Play pill opens the day's shared
 * board (src/core/dailyBoard.ts). A daily clear counts as a solve (streak and
 * totals) and records `arrows_daily_last_day`; it never advances the campaign
 * and never counts toward the interstitial. OFF: the menu renders as before and
 * the 'daily' route is unreachable; the stored key sits inert.
 */
export const META_DAILY = process.env.EXPO_PUBLIC_META_DAILY === '1';

/**
 * W4-09: a quiet `Gallery` control beside the daily line opens a calm,
 * non-tappable wall of the shapes the player has solved (src/ui/GalleryScreen.tsx):
 * collected shapes filled in ink with their name, the rest outlined, no level
 * numbers, no route into a board. Opening it catches the collection up
 * (W4-07's sliced fold). OFF: the menu renders as before and the 'gallery'
 * route is unreachable; the collection keeps accruing harmlessly.
 */
export const META_GALLERY = process.env.EXPO_PUBLIC_META_GALLERY === '1';

/**
 * W4-11: the OS store-review prompt (expo-store-review: Play In-App Review /
 * StoreKit) after a perfect campaign or daily clear, gated by
 * src/core/reviewPolicy.ts and asked REVIEW_DWELL_MS after the win panel
 * commits (src/ui/reviewPrompt.ts). No button, no question, no reward: the OS
 * card is the only thing the player sees, and usually nothing appears at all.
 * OFF: expo-store-review is never loaded or called and the two review keys
 * sit untouched, exactly as before (rollback).
 */
export const META_REVIEW_PROMPT = process.env.EXPO_PUBLIC_META_REVIEW_PROMPT === '1';

/**
 * W2-09: the blocked arrow's magenta outlasts its lunge. The colour mix holds
 * pure heart until the bump reaches its peak displacement, then releases to
 * ink (or the missed mark) by k = 1 (src/ui/feedbackCurves.ts
 * `blockedFlashMixAt`, both renderers). Timing, travel and reduced motion are
 * unchanged. OFF: the shipped easeOutQuad mix, value for value.
 */
export const META_BLOCKED_INK_HOLD = process.env.EXPO_PUBLIC_META_BLOCKED_INK_HOLD === '1';

/**
 * W2-07: the heart an earned rewarded continue refills gets a pop of its own.
 * The pip starts below rest (1 / 1.35) and springs up to 1, the mirror of the
 * loss overshoot, once the lose panel is gone (with META_PANEL_MOTION, after
 * its exit settles) (src/ui/heartPip.ts). Retry and Next never pop. OFF: the
 * pip recolours with no motion, exactly as before.
 */
export const META_HEART_REFILL_POP = process.env.EXPO_PUBLIC_META_HEART_REFILL_POP === '1';

/**
 * W2-08: the menu's theme toggle dips through a flat scrim in the DESTINATION
 * palette's background (cover 180 ms, swap the theme and write it once under
 * full cover, uncover 180 ms; W2-04's scrim and timings, src/ui/themeTransition.ts)
 * instead of re-colouring every view in one frame. A luminance dip through a flat
 * colour, not a content cross-fade. Reduced motion keeps the plain cut. OFF: the
 * toggle flips the theme in one frame, exactly as before.
 */
export const META_THEME_TRANSITION = process.env.EXPO_PUBLIC_META_THEME_TRANSITION === '1';

/**
 * W2-06: the post-clear timeline. The won panel waits for the final exit's last pixel to leave, then a fixed
 * empty-board hold (EMPTY_BOARD_HOLD_MS) and W5's reveal slot (CLEAR_REVEAL_MS, 0), instead of a flat 450 ms from
 * the last tap, so the empty board no longer shows for longer after a short last exit than after a long one. The
 * final exit may be stretched by FINAL_EXIT_FACTOR (1.0 until the owner picks). OFF: the flat 450 ms and the
 * unchanged final exit, exactly as before (src/ui/gameSessionLifecycle.ts, src/ui/exitToScreenEdge.ts).
 */
export const META_POST_CLEAR_TIMELINE = process.env.EXPO_PUBLIC_META_POST_CLEAR_TIMELINE === '1';
