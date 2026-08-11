import { type CacheKey, getPluginCache } from "../cache/PluginCache.ts";

/**
 * Options for {@link getCached}.
 */
export interface CacheOptions {
  /** Time-to-live in milliseconds. Entries older than this are refetched. */
  ttlMs: number;
  /**
   * If true, a stale entry is returned (and refreshed in the background) when the
   * factory throws. Use this for data that is "nice-to-have-fresh" but where keeping
   * the previous value is better than failing.
   */
  staleOnError?: boolean;
}

interface CacheEntry<T> {
  value: T;
  expires: number;
}

/**
 * Reads a value from the plugin cache and refreshes it via `factory()` when stale.
 *
 * A plugin-wide cache helper for `@samples/*` plugins that need to memoize expensive
 * upstream calls (e.g. PRH OpenData code lookups). Backed by the pluggable {@link PluginCache}
 * ({@link setPluginCache}); the default in-process backend does not survive restarts.
 *
 * @param key A cache key. Prefix it with your plugin id, e.g. `["prh", "description", "YRMU", "fi"]`.
 * @param factory Function that fetches a fresh value when the cache misses or is expired.
 * @param options TTL (required) and stale-on-error flag.
 * @returns The cached value, refreshed if needed.
 */
export async function getCached<T>(
  key: CacheKey,
  factory: () => Promise<T>,
  options: CacheOptions,
): Promise<T> {
  const cache = getPluginCache();
  // Store our own {value, expires} wrapper with no TTL on the entry, so a stale value remains
  // available for `staleOnError` even after logical expiry.
  const cached = await cache.get<CacheEntry<T>>(key);
  const now = Date.now();
  if (cached && cached.expires > now) {
    return cached.value;
  }
  try {
    const value = await factory();
    await cache.set(key, { value, expires: now + options.ttlMs } satisfies CacheEntry<T>);
    return value;
  } catch (error) {
    if (options.staleOnError && cached) {
      return cached.value;
    }
    throw error;
  }
}

/**
 * Deletes a single cache entry. Useful in tests and when invalidating after a known change.
 * @param key The cache key to delete.
 */
export async function clearCached(key: CacheKey): Promise<void> {
  await getPluginCache().delete(key);
}
