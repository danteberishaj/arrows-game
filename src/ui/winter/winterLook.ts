import { useSyncExternalStore } from 'react';
import { META_WINTER_DECOR } from '../../featureFlags';
import { inSeason, validateSeason, type Season } from '../seasons';
import { seasonNow } from '../seasonClock';

/**
 * WINTER-01 look state. The decoration shows while any winter window is on (New Year 12-01..01-15 sits inside
 * Winter 12-01..02-29). Variants exist for owner review in QA builds (QaWinterChips); store builds use the defaults.
 */
const WINTER_WINDOW: Season = validateSeason({ id: 'winter-decor', name: 'Winter', start: '12-01', end: '02-29' });

export function winterDecorOn(now: Date = seasonNow(), flag: boolean = META_WINTER_DECOR): boolean {
  return flag && inSeason(WINTER_WINDOW, now);
}

/** 'lights-hills' = Blender garland + hills; 'painted' = Codex-illustrated garland + hills (owner A/B); 'hills' = hills only. */
export type MenuLook = 'lights-hills' | 'painted' | 'hills' | 'off';
/** 'auto' = store rule: frame for everyone in season, snowfall only under a Winter skin; 'frame'/'snow' force one (QA A/B). */
export type BoardLook = 'auto' | 'frame' | 'snow' | 'off';
/** Exit snow (native, SnowFx.kt): 'full' = kick-up + streak/lucky/last-arrow moments; 'lite' = kick-up dots only. */
export type ExitLook = 'full' | 'lite' | 'off';
export interface WinterLook { menu: MenuLook; board: BoardLook; exit: ExitLook }

export const MENU_LOOKS: readonly MenuLook[] = ['painted', 'lights-hills', 'hills', 'off'];
export const BOARD_LOOKS: readonly BoardLook[] = ['auto', 'frame', 'snow', 'off'];
export const EXIT_LOOKS: readonly ExitLook[] = ['full', 'lite', 'off'];
export const DEFAULT_LOOK: WinterLook = { menu: 'painted', board: 'auto', exit: 'full' }; // painted = recommended (owner A/B on device)

let look: WinterLook = DEFAULT_LOOK;
const listeners = new Set<() => void>();

export function getWinterLook(): WinterLook { return look; }
export function setWinterLook(next: Partial<WinterLook>): void {
  look = { ...look, ...next };
  listeners.forEach(l => l());
}
function subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }
export function useWinterLook(): WinterLook { return useSyncExternalStore(subscribe, getWinterLook, getWinterLook); }

export function cycle<T>(list: readonly T[], value: T): T { return list[(list.indexOf(value) + 1) % list.length]; }

const EXIT_MODE: Record<ExitLook, number> = { full: 1, lite: 2, off: 0 };
const isDarkHex = (hex: string) => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return Number.isFinite(n) && (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 128;
};
/** The native `seasonFx` payload, or undefined out of season (the prop is then never sent). */
export function seasonFxPayload(look: WinterLook, background: string, diag: boolean, on: boolean = winterDecorOn()): string | undefined {
  return on ? `${EXIT_MODE[look.exit]},${isDarkHex(background) ? 1 : 0},${diag ? 1 : 0}` : undefined;
}
