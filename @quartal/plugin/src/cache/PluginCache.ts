/**
 * Pluggable key-value cache — the Node/edge replacement for the former Deno KV singleton.
 *
 * The default {@link MemoryCache} is per-process (values do not survive a restart), which is fine
 * for edge/serverless where each instance re-verifies on demand. Durable/shared backends
 * (Cloudflare KV, Redis, Deno KV, …) can be injected with {@link setPluginCache}.
 */

/** A structured cache key (array of path segments), mirroring Deno KV's key shape. */
export type CacheKey = readonly (string | number)[];

/** Minimal cache contract used by the framework (auth-context cache, icon cache, plugin caches). */
export interface PluginCache {
  /** Returns the cached value, or `undefined` if missing/expired. */
  get<T>(key: CacheKey): Promise<T | undefined>;
  /** Stores a value. `ttlMs` (optional) expires the entry after that many milliseconds. */
  set<T>(key: CacheKey, value: T, options?: { ttlMs?: number }): Promise<void>;
  /** Deletes a single entry. */
  delete(key: CacheKey): Promise<void>;
}

interface Entry {
  value: unknown;
  /** Epoch ms after which the entry is expired, or `null` for no expiry. */
  expires: number | null;
}

/** In-memory {@link PluginCache} with TTL support. Default backend; per-process only. */
export class MemoryCache implements PluginCache {
  private store = new Map<string, Entry>();

  private keyOf(key: CacheKey): string {
    return JSON.stringify(key);
  }

  get<T>(key: CacheKey): Promise<T | undefined> {
    const entry = this.store.get(this.keyOf(key));
    if (!entry) return Promise.resolve(undefined);
    if (entry.expires !== null && entry.expires <= Date.now()) {
      this.store.delete(this.keyOf(key));
      return Promise.resolve(undefined);
    }
    return Promise.resolve(entry.value as T);
  }

  set<T>(key: CacheKey, value: T, options?: { ttlMs?: number }): Promise<void> {
    const expires = options?.ttlMs != null ? Date.now() + options.ttlMs : null;
    this.store.set(this.keyOf(key), { value, expires });
    return Promise.resolve();
  }

  delete(key: CacheKey): Promise<void> {
    this.store.delete(this.keyOf(key));
    return Promise.resolve();
  }
}

let current: PluginCache = new MemoryCache();

/** Returns the active cache backend (defaults to an in-process {@link MemoryCache}). */
export function getPluginCache(): PluginCache {
  return current;
}

/** Overrides the active cache backend (e.g. a durable KV in production). */
export function setPluginCache(cache: PluginCache): void {
  current = cache;
}
