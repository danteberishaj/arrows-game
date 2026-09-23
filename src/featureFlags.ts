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
