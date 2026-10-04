import type { IntStore } from '../core/saveSystem';
import { SEASONAL_REWARD_IDS } from './rewardCatalogue';
import { ARROW_STYLES, CLASSIC_STYLE, arrowStyleForNumber, type ArrowStyle } from './skinSpecs';

export const ARROW_SKIN_KEY = 'arrows_skin';
let selected = CLASSIC_STYLE;
let store: IntStore | null = null;
let seasonal = false;
const hidden = (style: ArrowStyle) => !seasonal && SEASONAL_REWARD_IDS.includes(style.numericId);
const listeners = new Set<() => void>();
function publish(style: ArrowStyle): void {
  if (selected === style) return;
  selected = style;
  listeners.forEach(listener => listener());
}
/**
 * Called once after boot hydration. Disabled builds never read the skin key. Without seasons (HALLOWEEN-01) a saved
 * seasonal id renders as Classic, with no repair write, so an enabled build still finds it.
 */
export function initializeArrowStyle(nextStore: IntStore | null, enabled: boolean, seasons = false): void {
  store = enabled ? nextStore : null;
  seasonal = enabled && seasons;
  const saved = store ? arrowStyleForNumber(store.getInt(ARROW_SKIN_KEY, 0)) : CLASSIC_STYLE;
  publish(hidden(saved) ? CLASSIC_STYLE : saved);
}
export function getArrowStyle(): ArrowStyle { return selected; }
export function subscribeArrowStyle(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function chooseArrowStyle(id: string): void {
  if (!store) return;
  const next = ARROW_STYLES.find(style => style.id === id) ?? CLASSIC_STYLE;
  if (hidden(next)) return; // a seasonal style is not selectable without seasons
  if (selected === next) return;
  // Same guarded/coalesced store as progress; a failed hydrate permits memory changes only.
  store.setInt(ARROW_SKIN_KEY, next.numericId);
  publish(next);
}
