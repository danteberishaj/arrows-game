import { QA_SPLASH_SLOWMO, QA_SPLASH_VARIANT } from '../featureFlags';

/**
 * SPLASH-VARIANTS: which intro the splash plays. 'stage' is the shipped one (owner pick 2026-11-20); the others are
 * review candidates, reachable only through the QA flags in featureFlags.ts.
 */
export const SPLASH_VARIANTS = ['stage', 'hop', 'escape', 'board'] as const;
export type SplashVariant = (typeof SPLASH_VARIANTS)[number];
export const SPLASH_NAMES: Record<SplashVariant, string> = { stage: 'Stage', hop: 'A Hop', escape: 'B Escape', board: 'C Board' };

let current: SplashVariant = (SPLASH_VARIANTS as readonly string[]).includes(QA_SPLASH_VARIANT)
  ? (QA_SPLASH_VARIANT as SplashVariant)
  : 'stage';

export const getSplashVariant = (): SplashVariant => current;
export function nextSplashVariant(): SplashVariant {
  current = SPLASH_VARIANTS[(SPLASH_VARIANTS.indexOf(current) + 1) % SPLASH_VARIANTS.length];
  return current;
}

/** QA only: how many times slower the next splash plays (EXPO_PUBLIC_QA_SPLASH_SLOWMO; 1 in store builds). */
let slowmo = QA_SPLASH_SLOWMO;
export const getSplashSlowmo = (): number => slowmo;
export function toggleSplashSlowmo(): number {
  slowmo = slowmo === 1 ? 8 : 1;
  return slowmo;
}
