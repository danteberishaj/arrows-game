import type { IntStore } from '../core/saveSystem';
import { ARROW_STYLES, CLASSIC_STYLE, arrowStyleForNumber, type ArrowStyle } from './skinSpecs';

export const ARROW_SKIN_KEY = 'arrows_skin';
let selected = CLASSIC_STYLE;
let store: IntStore | null = null;
const listeners = new Set<() => void>();
function publish(style: ArrowStyle): void {
  if (selected === style) return;
  selected = style;
  listeners.forEach(listener => listener());
}
/** Called once after boot hydration. Disabled builds never read the skin key. */
export function initializeArrowStyle(nextStore: IntStore | null, enabled: boolean): void {
  store = enabled ? nextStore : null;
  publish(store ? arrowStyleForNumber(store.getInt(ARROW_SKIN_KEY, 0)) : CLASSIC_STYLE);
}
export function getArrowStyle(): ArrowStyle { return selected; }
export function subscribeArrowStyle(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function chooseArrowStyle(id: string): void {
  if (!store) return;
  const next = ARROW_STYLES.find(style => style.id === id) ?? CLASSIC_STYLE;
  if (selected === next) return;
  // Same guarded/coalesced store as progress; a failed hydrate permits memory changes only.
  store.setInt(ARROW_SKIN_KEY, next.numericId);
  publish(next);
}
