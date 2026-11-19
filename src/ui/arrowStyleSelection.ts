import type { IntStore } from '../core/saveSystem';
import { SEASONAL_REWARD_IDS } from './rewardCatalogue';
import { ARROW_STYLES, CLASSIC_STYLE, arrowStyleForNumber, type ArrowStyle } from './skinSpecs';

export const ARROW_SKIN_KEY = 'arrows_skin';
let selected = CLASSIC_STYLE;
let store: IntStore | null = null;
let seasonal = false;
/** SKINS-DRAWER live preview: what the board shows while the drawer is open. In memory only, never saved. */
let preview: ArrowStyle | null = null;
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
export function getArrowStyle(): ArrowStyle { return preview ?? selected; }
/** The saved choice, ignoring any preview (the drawer's "In use" check). */
export function getSavedArrowStyle(): ArrowStyle { return selected; }
/**
 * SKINS-DRAWER: show `id` on the board without saving it; null reverts to the saved style. A hidden seasonal style
 * (seasons off) is ignored, like chooseArrowStyle. Without a store (picker disabled) it does nothing.
 */
export function previewArrowStyle(id: string | null): void {
  if (!store) return;
  const next = id === null ? null : ARROW_STYLES.find(style => style.id === id) ?? null;
  if (next && hidden(next)) return;
  const shown = preview ?? selected;
  preview = next === selected ? null : next;
  if ((preview ?? selected) !== shown) listeners.forEach(listener => listener());
}
export function subscribeArrowStyle(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function chooseArrowStyle(id: string): void {
  if (!store) return;
  const next = ARROW_STYLES.find(style => style.id === id) ?? CLASSIC_STYLE;
  if (hidden(next)) return; // a seasonal style is not selectable without seasons
  const hadPreview = preview !== null;
  preview = null; // equipping ends any drawer preview
  if (selected === next) {
    if (hadPreview) listeners.forEach(listener => listener());
    return;
  }
  // Same guarded/coalesced store as progress; a failed hydrate permits memory changes only.
  store.setInt(ARROW_SKIN_KEY, next.numericId);
  publish(next);
  introPending = next === CLASSIC_STYLE ? null : next.id;
}

/**
 * Skin showcase: the first board after the player equips a new style eases in once. In memory only (no save key):
 * equipping marks it, the next board mount consumes it.
 */
let introPending: string | null = null;
export function consumeSkinIntro(id: string): boolean {
  if (introPending !== id) return false;
  introPending = null;
  return true;
}
