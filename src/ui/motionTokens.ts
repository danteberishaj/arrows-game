import { Easing } from 'react-native-reanimated';

/**
 * MOTION-AUDIT (META_MOTION_POLISH): the shared curves, so enters, exits and presses stop hand-picking
 * Easing.out(quad / cubic) or ease-in per file. Values from Emil Kowalski's animation rules.
 */
/** Strong ease-out: anything entering, leaving or answering a press. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** Press-in: scale 1 -> PRESS_SCALE_POLISH, in this long, on EASE_OUT. */
export const PRESS_IN_POLISH_MS = 120;
/** A pressed button's scale: subtle, so a wide pill does not lurch (0.94 takes 6 % off every edge-to-edge width). */
export const PRESS_SCALE_POLISH = 0.97;
/** Release: a critically damped spring (no overshoot: a tap carries no momentum to bounce with). */
export const RELEASE_SPRING_POLISH = { duration: 260, dampingRatio: 1 } as const;

/** Settings sheet: enters over this long, leaves faster. */
export const SHEET_ENTER_MS = 220;
export const SHEET_EXIT_MS = 160;
/** The sheet's panel settles from this scale (a modal stays centred, so the origin is the centre). */
export const SHEET_ENTER_SCALE = 0.96;
