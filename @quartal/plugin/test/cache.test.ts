import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCached, getCached, getPluginCache, MemoryCache, setPluginCache } from "../src/index.ts";

beforeEach(() => {
  setPluginCache(new MemoryCache()); // fresh cache per test
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("MemoryCache", () => {
  it("stores, reads, and deletes by structured key", async () => {
    const cache = getPluginCache();
    await cache.set(["a", 1], { hi: true });
    expect(await cache.get<{ hi: boolean }>(["a", 1])).toEqual({ hi: true });
    expect(await cache.get(["a", 2])).toBeUndefined(); // different key
    await cache.delete(["a", 1]);
    expect(await cache.get(["a", 1])).toBeUndefined();
  });

  it("expires entries after ttlMs", async () => {
    const cache = getPluginCache();
    await cache.set(["ttl"], "v", { ttlMs: 1000 });
    expect(await cache.get(["ttl"])).toBe("v");
    vi.advanceTimersByTime(1001);
    expect(await cache.get(["ttl"])).toBeUndefined();
  });
});

describe("getCached / clearCached", () => {
  it("fetches once, serves cached until expiry, then refetches", async () => {
    let calls = 0;
    const factory = () => Promise.resolve(++calls);
    const key = ["pkg", "x"];

    expect(await getCached(key, factory, { ttlMs: 1000 })).toBe(1);
    expect(await getCached(key, factory, { ttlMs: 1000 })).toBe(1); // cached, factory not called
    expect(calls).toBe(1);

    vi.advanceTimersByTime(1001);
    expect(await getCached(key, factory, { ttlMs: 1000 })).toBe(2); // refetched
    expect(calls).toBe(2);
  });

  it("returns a stale value on factory error when staleOnError is set", async () => {
    const key = ["pkg", "stale"];
    await getCached(key, () => Promise.resolve("fresh"), { ttlMs: 1000 });
    vi.advanceTimersByTime(1001);
    const value = await getCached(key, () => Promise.reject(new Error("upstream down")), {
      ttlMs: 1000,
      staleOnError: true,
    });
    expect(value).toBe("fresh");
  });

  it("throws on factory error without staleOnError", async () => {
    await expect(
      getCached(["pkg", "err"], () => Promise.reject(new Error("boom")), { ttlMs: 1000 }),
    ).rejects.toThrow("boom");
  });

  it("clearCached removes the entry", async () => {
    const key = ["pkg", "clear"];
    await getCached(key, () => Promise.resolve("v"), { ttlMs: 100000 });
    await clearCached(key);
    let calls = 0;
    await getCached(key, () => Promise.resolve(++calls && "v2"), { ttlMs: 100000 });
    expect(calls).toBe(1); // refetched after clear
  });
});
