/**
 * Low-level HTTP client for the three PRH Open Data services. Wraps `fetch` with
 * - shared user-agent (so PRH ops can identify our traffic in their logs)
 * - 200/204 → JSON, 404 → null, anything else → typed `PrhFetchError`
 * - query-string building that omits `undefined` / empty params
 *
 * Keep this dependency-free: callers compose tools (Companies / Financials / Notices)
 * on top of it and add caching where appropriate.
 */

/** Roots of the three PRH Open Data REST APIs, version 3. */
export const PRH_BASES = {
  /** Yritys- ja yhteisötietojärjestelmä (YTJ) — basic company data. */
  ytj: "https://avoindata.prh.fi/opendata-ytj-api/v3",
  /** XBRL digital financial statements. */
  xbrl: "https://avoindata.prh.fi/opendata-xbrl-api/v3",
  /** Registered notices (Kaupparekisteri / KREK). */
  krek: "https://avoindata.prh.fi/opendata-registerednotices-api/v3",
} as const;

const USER_AGENT = "samples/prh-opendata (https://github.com/quartal-hub/plugin)";

/** Error thrown for non-2xx responses or upstream failures. Includes status and body. */
export class PrhFetchError extends Error {
  /** @param message Human-readable error message.
   * @param status HTTP status code returned by PRH (`0` for network errors).
   * @param body Raw response body, for debugging.
   * @param url Fully-formed URL that failed.
   */
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
    public readonly url: string,
  ) {
    super(message);
    this.name = "PrhFetchError";
  }
}

/** Allowed query value primitives. */
export type QueryValue = string | number | boolean | undefined | null;

/**
 * Builds a URL with PRH-friendly query string. Skips `undefined`, `null`, and empty-string
 * values so optional parameters drop out cleanly.
 * @param base Service root (one of {@link PRH_BASES}).
 * @param path Path that begins with `/`.
 * @param query Query parameters (omitted if empty/undefined/null).
 */
export function buildPrhUrl(base: string, path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(base + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Fetches PRH JSON and returns it as `T`. Returns `null` on 404 so callers can treat
 * "no such business id" as a normal empty result.
 * @param url Fully-formed URL from {@link buildPrhUrl}.
 * @throws PrhFetchError on any non-2xx (other than 404).
 */
export async function fetchPrhJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
  });
  if (res.status === 404) {
    await res.body?.cancel();
    return null;
  }
  if (!res.ok) {
    const body = await safeRead(res);
    throw new PrhFetchError(`PRH responded ${res.status} for ${url}`, res.status, body, url);
  }
  return await res.json() as T;
}

/**
 * Fetches PRH text content (used for `/description` and the `/financial` XBRL XML).
 * @param url Fully-formed URL from {@link buildPrhUrl}.
 * @returns The response body as a string, or `null` on 404.
 */
export async function fetchPrhText(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept": "text/plain, text/xml, application/json" },
  });
  if (res.status === 404) {
    await res.body?.cancel();
    return null;
  }
  if (!res.ok) {
    const body = await safeRead(res);
    throw new PrhFetchError(`PRH responded ${res.status} for ${url}`, res.status, body, url);
  }
  return await res.text();
}

async function safeRead(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
