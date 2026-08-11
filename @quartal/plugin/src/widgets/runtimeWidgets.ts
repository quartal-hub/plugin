import { join } from "node:path";
import type { Hono } from "hono";

import { Helpers } from "../helpers/Helpers.ts";
import type { WidgetCsp } from "../model/index.ts";
import { discoverWidgets } from "./discoverWidgets.ts";
import type { WidgetEntry } from "./widgetTypes.ts";

/**
 * Runtime widget serving. A widget MCP resource is the live Astro page (`/widgets/<toolId>`) fetched
 * on `resources/read` — not a build-time re-bundled blob. The page HTML keeps Astro's normal chunked
 * output; its root-relative asset references are rewritten to absolute URLs on the serving origin so
 * the sandboxed host iframe loads them over HTTP (shared, cached across widgets and renders). The
 * origin is whitelisted in the widget CSP, and assets are served through {@link WIDGET_ASSETS_PREFIX}
 * — a same-origin passthrough that adds the CORS header module scripts require cross-origin.
 */

/** Default widget-pages directory relative to the plugin root. */
export const WIDGET_PAGES_DIR = "src/pages/widgets";

/**
 * Path prefix on the plugin origin that mirrors same-origin content with `Access-Control-Allow-Origin`
 * added. Widget iframes run on a host sandbox origin, and ES-module scripts are always fetched in CORS
 * mode, so plain `/_astro/*` responses (served statically by the adapter, without CORS headers) would be
 * blocked. Rewritten widget HTML points at `<origin>/widget-assets/_astro/…` instead.
 */
export const WIDGET_ASSETS_PREFIX = "/widget-assets";

/** Renders a widget's live page HTML for `resources/read`; `null` when the page cannot be fetched. */
export type FetchWidgetHtml = (entry: WidgetEntry, origin: string) => Promise<string | null>;

/**
 * Resolves the plugin's widget entries at runtime: discovers pages under `src/pages/widgets/` and
 * applies the `qrtl.config` `widgets` section (names, CSP) — the same read-from-disk model as the
 * other `qrtl-plugin` metadata. Missing directory → `[]`.
 * @param config Plugin root (defaults to the current working directory).
 */
export async function resolveWidgetEntries(config: {
  pluginRootFolder?: string;
}): Promise<WidgetEntry[]> {
  const root = config.pluginRootFolder ?? process.cwd();
  const qrtl = await Helpers.loadQrtlConfig(root);
  const discovered = await discoverWidgets(join(root, WIDGET_PAGES_DIR), qrtl?.widgets);
  return discovered.map((w) => ({
    toolId: w.toolId,
    uri: `ui://widgets/${w.toolId}.html`,
    name: w.name,
    pagePath: `/widgets/${w.toolId}`,
    ...(w.csp ? { csp: w.csp } : {}),
  }));
}

/** Attribute names whose root-relative URL values are rewritten to the widget-assets origin. */
const URL_ATTR_RE = /\b(src|href|component-url|renderer-url|before-hydration-url)(\s*=\s*)(["'])([^"']*)\3/gi;

/**
 * Rewrites the page's root-relative URL references (`/_astro/*` chunks, `<astro-island>` component/
 * renderer URLs, stylesheets, preloads — and in dev, Vite module URLs) to absolute URLs under
 * `<origin>/widget-assets/…`. External (`http(s)://`, `//`, `data:`) references are left untouched.
 * The MCP host renders the resource HTML with no usable document base URL (srcdoc/sandbox), so every
 * local reference must be absolute.
 * @param html The widget page HTML as served by Astro.
 * @param origin The plugin server origin (scheme + host) the reading client used.
 */
export function rewriteWidgetHtml(html: string, origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return html.replace(URL_ATTR_RE, (whole, attr: string, eq: string, quote: string, value: string) => {
    if (!value.startsWith("/") || value.startsWith("//")) return whole;
    if (value.startsWith(WIDGET_ASSETS_PREFIX + "/")) return `${attr}${eq}${quote}${base}${value}${quote}`;
    return `${attr}${eq}${quote}${base}${WIDGET_ASSETS_PREFIX}${value}${quote}`;
  });
}

/**
 * Returns the widget CSP with the serving origin whitelisted in `resourceDomains` and `connectDomains`,
 * so the host sandbox allows loading the rewritten `/widget-assets/…` URLs (and fetching the plugin
 * API) from the plugin origin.
 * @param csp The widget's configured CSP, if any.
 * @param origin The plugin server origin.
 */
export function withWidgetOrigin(csp: WidgetCsp | undefined, origin: string): WidgetCsp {
  const add = (list?: string[]): string[] => (list?.includes(origin) ? list : [...(list ?? []), origin]);
  return {
    ...(csp ?? {}),
    resourceDomains: add(csp?.resourceDomains),
    connectDomains: add(csp?.connectDomains),
  };
}

/** Default {@link FetchWidgetHtml}: fetches the live page from the serving origin (loopback). */
export const defaultFetchWidgetHtml: FetchWidgetHtml = async (entry, origin) => {
  const pagePath = entry.pagePath ?? `/widgets/${entry.toolId}`;
  try {
    const res = await fetch(new URL(pagePath, origin), { headers: { accept: "text/html" } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
};

/**
 * Mounts the widget-assets passthrough: `GET /widget-assets/<path>` responds with the same-origin
 * `GET /<path>` response plus `Access-Control-Allow-Origin: *` (module scripts in the sandboxed widget
 * iframe are cross-origin CORS requests) and an immutable cache policy for hashed `/_astro/*` chunks.
 * Same-origin and GET-only, with no forwarded credentials — it mirrors only what the plugin already
 * serves publicly. This runs through the Hono app (an on-demand route), which is what makes the headers
 * possible at all: the adapter serves `/_astro/*` statically, before any middleware could add them.
 * @param app The plugin's Hono app.
 */
export function registerWidgetAssetRoutes(app: Hono): void {
  app.get(`${WIDGET_ASSETS_PREFIX}/*`, async (c) => {
    const url = new URL(c.req.url);
    const subpath = url.pathname.slice(WIDGET_ASSETS_PREFIX.length);
    // Same-origin paths only; refuse protocol-relative escapes and self-recursion.
    if (!subpath.startsWith("/") || subpath.startsWith("//") || subpath.startsWith(WIDGET_ASSETS_PREFIX + "/")) {
      return c.notFound();
    }
    let upstream: Response;
    try {
      upstream = await fetch(new URL(subpath + url.search, url.origin), {
        headers: { accept: c.req.header("accept") ?? "*/*" },
      });
    } catch {
      return c.text("widget asset unreachable", 502);
    }
    const headers = new Headers(upstream.headers);
    // fetch() has already decoded the body; drop the stale encoding/length headers.
    headers.delete("content-encoding");
    headers.delete("content-length");
    headers.set("access-control-allow-origin", "*");
    if (subpath.startsWith("/_astro/")) {
      headers.set("cache-control", "public, max-age=31536000, immutable");
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  });
}
