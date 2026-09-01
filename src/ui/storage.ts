import AsyncStorage from '@react-native-async-storage/async-storage';
import { SaveSystem, type IntStore } from '../core/saveSystem';

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

  async hydrate(): Promise<void> {
    try {
      const pairs = await AsyncStorage.multiGet(SaveSystem.persistenceKeys);
      for (const [key, value] of pairs) {
        if (value !== null) {
          const n = parseInt(value, 10);
          if (!Number.isNaN(n)) this.cache.set(key, n);
        }
      }
    } catch {
      // No persistence (e.g. private browsing): play with in-memory state.
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

/** Hydrates saved progress and points SaveSystem at persistent storage. */
export async function initSaveSystem(): Promise<void> {
  const store = new HydratedIntStore();
  await store.hydrate();
  SaveSystem.useStore(store);
}
