/**
 * SKINS-DRAWER (META_SKINS_DRAWER): the drawer's pure logic, kept apart from the component so it is testable.
 * Owner picks 2026-11-19: two snaps (~55 % and ~92 % of the window), drag down or tap above to close,
 * live preview, one grid with an inline buy / use bar.
 *
 * Positions are the sheet's translateY in dp: 0 = fully up (the "full" snap), `closed` = off screen.
 */

/** OWNER-PICKED 2026-11-19: the half snap shows this share of the window, the full snap this share. */
export const DRAWER_HALF_SHARE = 0.55;
export const DRAWER_FULL_SHARE = 0.92;

export interface DrawerSnaps {
  /** The sheet's own height (the full snap's visible height). */
  sheetH: number;
  full: number;
  half: number;
  closed: number;
}

export function drawerSnaps(windowH: number): DrawerSnaps {
  const sheetH = Math.round(windowH * DRAWER_FULL_SHARE);
  return { sheetH, full: 0, half: sheetH - Math.round(windowH * DRAWER_HALF_SHARE), closed: sheetH };
}

/** Where a flick was heading if it kept decelerating (Apple's exponential decay; velocity in dp/s). */
export function project(velocity: number, decelerationRate = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Past an edge, the sheet follows less the further the finger goes. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export type DrawerTarget = 'full' | 'half' | 'closed';

/**
 * Release: velocity OR distance decides. The projected resting point picks the nearest of full / half / closed,
 * so a short fast flick down from half closes, and a slow drag that stops near half stays at half.
 */
export function releaseTarget(y: number, velocityY: number, s: DrawerSnaps): DrawerTarget {
  'worklet';
  const p = y + project(velocityY);
  const dFull = Math.abs(p - s.full);
  const dHalf = Math.abs(p - s.half);
  const dClosed = Math.abs(p - s.closed);
  if (dClosed < dHalf && dClosed < dFull) return 'closed';
  return dFull <= dHalf ? 'full' : 'half';
}

export function targetY(t: DrawerTarget, s: DrawerSnaps): number {
  'worklet';
  return t === 'full' ? s.full : t === 'half' ? s.half : s.closed;
}

/** What the bottom bar offers for the selected tile. */
export type DrawerAction =
  | { kind: 'inUse' }
  | { kind: 'use' }
  | { kind: 'buy'; price: number; left: number }
  | { kind: 'short'; price: number; need: number }
  | { kind: 'paused'; price: number };

export function drawerAction(o: {
  owned: boolean;
  equipped: boolean;
  price: number | null;
  petals: number;
  canBuy: boolean;
}): DrawerAction {
  if (o.owned) return o.equipped ? { kind: 'inUse' } : { kind: 'use' };
  const price = o.price ?? 0;
  if (!o.canBuy) return { kind: 'paused', price };
  if (o.petals < price) return { kind: 'short', price, need: price - o.petals };
  return { kind: 'buy', price, left: o.petals - price };
}

const petalWord = (n: number) => (n === 1 ? 'petal' : 'petals');

/** The bar's button label and the line under it. */
export function drawerActionCopy(a: DrawerAction): { button: string; line: string; enabled: boolean } {
  switch (a.kind) {
    case 'inUse': return { button: 'In use', line: '', enabled: false };
    case 'use': return { button: 'Use it', line: '', enabled: true };
    case 'buy': return { button: `Buy for ${a.price} ${petalWord(a.price)}`, line: `You'll have ${a.left} left`, enabled: true };
    case 'short': return { button: `Buy for ${a.price} ${petalWord(a.price)}`, line: `You need ${a.need} more ${petalWord(a.need)}`, enabled: false };
    case 'paused': return { button: `Buy for ${a.price} ${petalWord(a.price)}`, line: 'Buying is paused right now', enabled: false };
  }
}
