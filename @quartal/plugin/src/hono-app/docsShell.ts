import { readStaticText } from "./staticFileUtils.ts";

/**
 * The docs UI shell: a chrome-less page published on the Quartal Plugins website whose HTML every
 * deployed plugin fetches, rewrites and serves at `/`. The document therefore stays on the plugin's
 * own origin (same-origin data fetches, OAuth login flow), while the scripts and styles load from
 * the website's CDN — no docs assets ship inside the plugin or its server bundle.
 */

/** Where the docs shell page is published. Override with `QRTL_DOCS_WEB_URL`. */
export const DEFAULT_DOCS_WEB_URL = "https://plugin.quartal.com/plugin-index/";

/** How long a fetched shell is served before re-fetching (running servers pick up UI updates). */
const SHELL_TTL_MS = 60 * 60 * 1000;

/** Abort a shell fetch after this long: a hanging upstream must fail the docs route, not wedge it. */
const SHELL_FETCH_TIMEOUT_MS = 10_000;

/**
 * Resolves the docs shell URL: the `QRTL_DOCS_WEB_URL` env var wins (per-deployment override,
 * self-hosted copies, the local website dev server), then the configured value, then the published
 * default. `file:` URLs are supported for tests; a browser cannot load assets from one.
 * @param configured Shell URL from `PluginAppConfig.docsWebUrl`, if any.
 */
export function resolveDocsWebUrl(configured?: string): string {
  return process.env.QRTL_DOCS_WEB_URL || configured || DEFAULT_DOCS_WEB_URL;
}

/** Attributes whose root-relative URL values are rewritten to the shell's own origin. */
const SHELL_URL_ATTR_RE = /\b(src|href)(\s*=\s*)(["'])(\/[^"']*)\3/gi;

/**
 * Rewrites the shell's root-relative `src`/`href` references (`/_astro/*` scripts and styles,
 * icons) to absolute URLs on the shell's origin, so they load from the website CDN while the
 * document itself is served from the plugin's origin. Absolute (`http(s)://`, `//`) references and
 * fragment/relative links are left untouched.
 * @param html The shell page HTML as published.
 * @param shellUrl The URL the shell was fetched from.
 */
export function rewriteDocsShellHtml(html: string, shellUrl: string): string {
  return html.replace(SHELL_URL_ATTR_RE, (whole, attr: string, eq: string, quote: string, value: string) => {
    if (value.startsWith("//")) return whole;
    return `${attr}${eq}${quote}${new URL(value, shellUrl).href}${quote}`;
  });
}

/**
 * Returns a shell getter with an in-memory TTL cache: the first request fetches, later requests
 * are served from memory, a stale copy triggers a re-fetch, and a failed re-fetch falls back to
 * the stale copy — a network blip never takes a working docs page down. Returns `undefined` only
 * when no copy has ever been fetched (the route answers 503, and the next request retries).
 * @param shellUrl The docs shell URL (http(s) or file).
 */
async function fetchWithTimeout(url: URL): Promise<string | undefined> {
  const res = await fetch(url, { signal: AbortSignal.timeout(SHELL_FETCH_TIMEOUT_MS) });
  if (!res.ok) return undefined;
  return await res.text();
}

export function createDocsShellFetcher(shellUrl: string): () => Promise<string | undefined> {
  let cached: { html: string; at: number } | undefined;
  let pending: Promise<string | undefined> | undefined;

  const fetchShell = async (): Promise<string | undefined> => {
    try {
      const url = new URL(shellUrl);
      const html = url.protocol === "file:"
        ? await readStaticText(url)
        : await fetchWithTimeout(url);
      if (html) cached = { html, at: Date.now() };
      return cached?.html;
    } catch {
      return cached?.html;
    } finally {
      pending = undefined;
    }
  };

  return async () => {
    if (cached && Date.now() - cached.at < SHELL_TTL_MS) return cached.html;
    pending ??= fetchShell();
    return pending;
  };
}
