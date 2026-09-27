import React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * W5-02 (ART_ICONS_ENABLED, artConfig.ts): one SVG icon set for the control marks that were text glyphs drawn by
 * whatever font the OS picked (‹ 💡 ☀ ☾ ♪ ★ ✦ ♥). An SVG path honours its colour on every platform; the colour emoji
 * 💡 ☀ ♥ ignored the `color` the app set (Android paints them yellow and red). Every path is drawn in a 24 x 24
 * viewBox. The sound-off icon differs from sound-on by SHAPE (no waves, a slash), not by colour alone.
 */

/** Stroke width of every stroked icon, in 24-unit viewBox units (the drafts proposed 2 and 2.2). */
export const ICON_STROKE = 2; // OWNER-PICKED STARTING VALUE

export const ICON_NAMES = [
  'back',
  'hint',
  'sun',
  'moon',
  'soundOn',
  'soundOff',
  'star',
  'sparkle',
  'heart',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** One path of an icon: filled in the icon's colour, or stroked at ICON_STROKE with round caps and joins. */
export interface IconPart {
  readonly d: string;
  readonly paint: 'fill' | 'stroke';
}

/**
 * Filled-heart silhouette (24×24 viewBox), moved here from GameScreen. SVG fill honours our colour, unlike the bare
 * ♥ glyph, which Android paints as a red emoji regardless of the text `color`, so a spent pip never dimmed (it
 * stayed full red). GameScreen's HeartPip draws it filled (a heart left) or as an OUTLINE (spent), so hearts left
 * read by shape, not by colour alone (W0-06).
 */
export const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 ' +
  '4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 ' +
  '11.54L12 21.35z';

/** The speaker both sound icons share, so they read as one control in two states. */
const SPEAKER = 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z';

const stroke = (d: string): IconPart => Object.freeze({ d, paint: 'stroke' as const });
const fill = (d: string): IconPart => Object.freeze({ d, paint: 'fill' as const });

/** The icon record: every icon's parts, drawn in order. Frozen. */
export const ICONS: Readonly<Record<IconName, readonly IconPart[]>> = Object.freeze({
  /** A small chevron (the "‹" back mark). */
  back: Object.freeze([stroke('M15 5l-7 7 7 7')]),
  /** A bulb outline: the glass, then the two lines of its base. */
  hint: Object.freeze([
    stroke('M9 16c0-2.2-3.5-3.6-3.5-7.5a6.5 6.5 0 0 1 13 0c0 3.9-3.5 5.3-3.5 7.5z'),
    stroke('M9.5 19h5'),
    stroke('M10.5 22h3'),
  ]),
  /** A disc and eight rays. */
  sun: Object.freeze([
    stroke('M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0z'),
    stroke('M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41'),
  ]),
  /** A crescent. */
  moon: Object.freeze([stroke('M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a8 8 0 0 0 11 11z')]),
  /** The speaker and two sound waves. */
  soundOn: Object.freeze([
    stroke(SPEAKER),
    stroke('M15.5 9a4.5 4.5 0 0 1 0 6'),
    stroke('M18.5 6.5a8 8 0 0 1 0 11'),
  ]),
  /** The speaker, no waves, and a slash across the whole icon. */
  soundOff: Object.freeze([stroke(SPEAKER), stroke('M3 3l18 18')]),
  /** A filled five-point star (outer radius 11, inner 0.42 of it), its bounding box centred. */
  star: Object.freeze([
    fill('M12 2.05L14.72 9.31L22.46 9.65L16.39 14.48L18.47 21.95L12 17.67L5.53 21.95L7.61 14.48L1.54 9.65L9.28 9.31Z'),
  ]),
  /** A filled four-point sparkle. */
  sparkle: Object.freeze([
    fill('M12 2C12.8 8.5 15.5 11.2 22 12C15.5 12.8 12.8 15.5 12 22C11.2 15.5 8.5 12.8 2 12C8.5 11.2 11.2 8.5 12 2Z'),
  ]),
  heart: Object.freeze([fill(HEART_PATH)]),
});

/** One icon, `size` dp square, in `color`. */
export function Icon({ name, size, color }: { name: IconName; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {ICONS[name].map((part, i) =>
        part.paint === 'stroke' ? (
          <Path
            key={i}
            d={part.d}
            fill="none"
            stroke={color}
            strokeWidth={ICON_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <Path key={i} d={part.d} fill={color} />
        ),
      )}
    </Svg>
  );
}
