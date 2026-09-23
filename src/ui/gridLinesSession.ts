/**
 * POLISH-T4 (ruling R5): the "#" grid-lines toggle is session-only. It lives
 * in this module, so it survives level changes and menu <-> game within the
 * process and is OFF after a cold start. No save key (a key needs a P-01
 * schema amendment, out of scope).
 */
let linesOn = false;
const listeners = new Set<() => void>();

export function readGridLines(): boolean {
  return linesOn;
}

export function setGridLines(value: boolean): void {
  if (value === linesOn) return;
  linesOn = value;
  for (const listener of listeners) listener();
}

export function subscribeGridLines(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
