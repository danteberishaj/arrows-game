import AsyncStorage from '@react-native-async-storage/async-storage';
import { SaveSystem, type IntStore } from '../core/saveSystem';
import { ARROW_SKIN_KEY, initializeArrowStyle } from './arrowStyleSelection';
export { getArrowStyle, chooseArrowStyle } from './arrowStyleSelection';

/**
 * AsyncStorage-backed implementation of the core's synchronous IntStore
 * (Unity PlayerPrefs equivalent). AsyncStorage is async, so all `arrows_*`
 * keys owned by SaveSystem are hydrated into a memory cache once at boot;
 * reads are served from the cache and writes go through to AsyncStorage
 * fire-and-forget. On web AsyncStorage is a localStorage wrapper, so
 * persistence works everywhere.
 */
class HydratedIntStore implements IntStore {
  private readonly cache = new Map<string, number>();
  private readonly pending = new Map<string, string | null>();
  private flushScheduled = false;
  private persistence = Promise.resolve();
  /**
   * SAVE-GUARD: false after a failed hydrate. The session then runs on
   * in-memory defaults, and writing those through would overwrite the real
   * saved progress the read could not see (a clear on the default level 0
   * would store level 1 over level 37). Writes stay in memory until the next
   * launch reads the disk again.
   */
  private writeThrough = true;

  /** Reads every registered key. Returns false when the native read threw. */
  async hydrate(keys: readonly string[]): Promise<boolean> {
    try {
      const pairs = await AsyncStorage.multiGet(keys);
      for (const [key, value] of pairs) {
        if (value !== null) {
          const n = key === ARROW_SKIN_KEY
            ? (/^\d+$/.test(value) ? Number(value) : Number.NaN)
            : parseInt(value, 10);
          if (!Number.isNaN(n)) this.cache.set(key, n);
        }
      }
      return true;
    } catch {
      // No persistence (e.g. private browsing) or a transient read failure:
      // play with in-memory state and never write it over the unread save.
      this.writeThrough = false;
      return false;
    }
  }

  getInt(key: string, defaultValue: number): number {
    const v = this.cache.get(key);
    return v === undefined ? defaultValue : v;
  }

  setInt(key: string, value: number): void {
    this.cache.set(key, value);
    this.enqueue(key, String(value));
  }

  deleteKey(key: string): void {
    this.cache.delete(key);
    this.enqueue(key, null);
  }

  private enqueue(key: string, value: string | null): void {
    if (!this.writeThrough) return;
    this.pending.set(key, value);
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => this.flush());
  }

  private flush(): void {
    this.flushScheduled = false;
    const operations = [...this.pending];
    this.pending.clear();
    const writes = operations.filter((entry): entry is [string, string] => entry[1] !== null);
    const removals = operations.filter((entry) => entry[1] === null).map(([key]) => key);

    // Serialize batches so a later write/delete cannot finish before an older
    // one. Most game events collapse to one native multiSet or multiRemove.
    this.persistence = this.persistence
      .then(async () => {
        if (writes.length > 0) await AsyncStorage.multiSet(writes);
        if (removals.length > 0) await AsyncStorage.multiRemove(removals);
      })
      .catch(() => {});
  }
}

/**
 * Hydrates saved progress, points SaveSystem at persistent storage and runs the
 * additive schema migration. The migration runs only when the hydrate
 * succeeded: stamping a version over a save that was never read would mark it
 * migrated.
 */
export async function initSaveSystem(skinPicker = false): Promise<void> {
  const store = new HydratedIntStore();
  SaveSystem.setPersistenceHealthy(false);
  initializeArrowStyle(null, false);
  const healthy = await store.hydrate(skinPicker ? [...SaveSystem.persistenceKeys, ARROW_SKIN_KEY] : SaveSystem.persistenceKeys);
  SaveSystem.useStore(store);
  SaveSystem.setPersistenceHealthy(healthy);
  if (healthy) SaveSystem.migrate();
  initializeArrowStyle(store, skinPicker);
}


/** PERF capture only: read/write the additive preference, never hydrate/migrate or install a progress store. */
export async function initSkinPickerCapture(): Promise<void> {
  initializeArrowStyle(null, false);
  const store = new HydratedIntStore();
  await store.hydrate([ARROW_SKIN_KEY]);
  initializeArrowStyle(store, true);
}
