/**
 * A tiny observable boolean: "can a rewarded ad be shown right now?".
 *
 * Pure TS (no react-native import) so it is unit-testable in node. Values come
 * only from SDK callbacks (see ads.tsx); nothing here polls or times out.
 */
export interface Readiness {
  get(): boolean;
  /** Stores the value; subscribers hear about it only if it changed. */
  set(v: boolean): void;
  /** Returns an unsubscribe function. */
  subscribe(cb: (v: boolean) => void): () => void;
}

export function createReadiness(initial = false): Readiness {
  let value = initial;
  const subscribers = new Set<(v: boolean) => void>();
  return {
    get: () => value,
    set(v: boolean) {
      if (v === value) return;
      value = v;
      // Copy first: a subscriber may unsubscribe itself while being notified.
      for (const cb of [...subscribers]) cb(v);
    },
    subscribe(cb) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
  };
}
