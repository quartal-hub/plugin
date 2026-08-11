import { getPluginCache } from "../cache/PluginCache.ts";
import { guessIconMimeType } from "./pluginIcon.ts";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedIcon = {
  body: number[];
  mimeType: string;
};

async function iconCacheKey(sourceSrc: string): Promise<readonly string[]> {
  const data = new TextEncoder().encode(sourceSrc);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return ["hub-icon", Buffer.from(new Uint8Array(hash)).toString("hex")];
}

/** Fetches an icon from `sourceSrc`, cached via {@link getPluginCache} (24h TTL). */
export async function getCachedIcon(
  sourceSrc: string,
  mimeTypeHint?: string,
): Promise<{ body: Uint8Array; mimeType: string }> {
  const cache = getPluginCache();
  const key = await iconCacheKey(sourceSrc);
  const entry = await cache.get<CachedIcon>(key);
  if (entry) {
    return { body: new Uint8Array(entry.body), mimeType: entry.mimeType };
  }

  const res = await fetch(sourceSrc);
  if (!res.ok) {
    throw new Error(`Failed to fetch icon (${res.status}): ${sourceSrc}`);
  }
  const body = new Uint8Array(await res.arrayBuffer());
  const headerType = res.headers.get("content-type")?.split(";")[0]?.trim();
  const mimeType = mimeTypeHint ?? headerType ?? guessIconMimeType(sourceSrc);

  // Store as a plain number[] so any cache backend (including JSON-serializing ones) can hold it.
  await cache.set<CachedIcon>(key, { body: Array.from(body), mimeType }, { ttlMs: CACHE_TTL_MS });
  return { body, mimeType };
}
