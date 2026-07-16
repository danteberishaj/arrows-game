import AsyncStorage from '@react-native-async-storage/async-storage';
import { IntStore, SaveSystem } from '../core';

/**
 * AsyncStorage-backed implementation of the core's synchronous IntStore
 * (Unity PlayerPrefs equivalent). AsyncStorage is async, so all `arrows_*`
 * keys are hydrated into a memory cache once at boot; reads are served from
 * the cache and writes go through to AsyncStorage fire-and-forget. On web
 * AsyncStorage is a localStorage wrapper, so persistence works everywhere.
 */
class HydratedIntStore implements IntStore {
  private readonly cache = new Map<string, number>();

  async hydrate(): Promise<void> {
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('arrows_'));
      if (keys.length === 0) return;
      const pairs = await AsyncStorage.multiGet(keys);
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
    AsyncStorage.setItem(key, String(value)).catch(() => {});
  }

  deleteKey(key: string): void {
    this.cache.delete(key);
    AsyncStorage.removeItem(key).catch(() => {});
  }
}

/** Hydrates saved progress and points SaveSystem at persistent storage. */
export async function initSaveSystem(): Promise<void> {
  const store = new HydratedIntStore();
  await store.hydrate();
  SaveSystem.useStore(store);
}
