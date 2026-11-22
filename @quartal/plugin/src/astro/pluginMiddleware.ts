import type { Hono } from "hono";

import { isForbiddenCrossOriginRequest } from "./isForbiddenCrossOriginRequest.ts";

/** Minimal structural subset of Astro's middleware context (only what this middleware reads). */
export interface AstroMiddlewareContext {
  request: Request;
  /** The request URL as Astro resolved it; defaults to `request.url`. */
  url?: URL;
  /** Whether the matched route is prerendered (static) — such routes are never origin-checked. */
  isPrerendered?: boolean;
  /** Astro's per-request locals; the page session goes to `locals.qrtlSession`. */
  locals?: Record<string, unknown>;
}

/** Astro's middleware `next()` — renders the matched Astro route and resolves to its Response. */
export type AstroMiddlewareNext = () => Promise<Response>;

/** Astro middleware `onRequest` shape. */
export type MiddlewareOnRequest = (
  context: AstroMiddlewareContext,
  next: AstroMiddlewareNext,
) => Promise<Response>;

/** Server-route prefixes handled by the Hono app (delegated); everything else falls through to Astro. */
const SERVER_PREFIXES = [
  "/api",
  "/mcp",
  "/oauth",
  "/skills",
  "/agents",
  "/icons",
  "/widget-assets",
  "/.well-known",
  "/com.quartal.plugin",
];

/** Exact server paths handled by the Hono app (docs shell, generated docs, legacy redirects). */
const SERVER_EXACT = new Set([
  "/",
  "/favicon.ico",
  "/plugin.json",
  "/plugin.zip",
  "/mcp.json",
  "/open-api.json",
  "/types.json",
  "/readme.md",
  "/mcp.html",
  "/swagger.html",
  "/docs.html",
  "/skills.html",
  "/agents.html",
  "/widgets.js",
  "/widgets/routes.json",
  "/widgets/embed.md",
]);

/** The per-widget embedding guide (`/widgets/<toolId>/embed.md`); the widget pages themselves stay with Astro. */
const WIDGET_EMBED_GUIDE = /^\/widgets\/[^/]+\/embed\.md$/;

/**
 * The human-facing docs paths: the shell at `/` and the legacy redirects into its hash routes.
 * Released to Astro when the plugin ships its own `src/pages/index.*` — the machine routes
 * (`/plugin.json`, `/mcp`, `/api/*`, …) always stay with the Hono app.
 */
const DOCS_SHELL_PATHS = new Set(["/", "/mcp.html", "/swagger.html", "/docs.html", "/skills.html", "/agents.html"]);

/**
 * Whether a request path is served by the Hono app (REST/MCP/skills/agents/icons/docs-SPA/…)
 * rather than by an Astro page. Astro keeps everything else — widget pages (`/widgets/<toolId>`), its own
 * assets (`/_astro/*`, `/_image`), user pages, etc.
 * @param pathname URL pathname.
 */
export function isServerPath(pathname: string): boolean {
  if (SERVER_EXACT.has(pathname) || WIDGET_EMBED_GUIDE.test(pathname) || EXTENSION_FILE.test(pathname)) return true;
  return SERVER_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** A file of an extension directory: `/<reverse-domain namespace>/<path>`. */
const EXTENSION_FILE = /^\/[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+\/./;

/** Astro's own assets and the widget pages: never behind the page sign-in. */
const ALWAYS_OPEN = [/^\/_astro\//, /^\/_image(\/|$)/, /^\/widgets(\/|$)/];

/**
 * Turns a path glob into a matcher: `**` matches across segments, `*` within one.
 * @param glob A path glob such as `/register/**`.
 */
export function pathGlobMatcher(glob: string): (pathname: string) => boolean {
  const source = glob
    .split(/(\*\*\/?|\*)/)
    .map((part) => (part.startsWith("**") ? "(?:.*)" : part === "*" ? "[^/]*" : part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")))
    .join("");
  const re = new RegExp(`^${source}$`);
  return (pathname) => re.test(pathname);
}

/** {@link isServerPath} minus the docs shell paths — the matcher for a plugin with its own index page.
 * @param pathname URL pathname.
 */
export function isServerPathWithOwnIndexPage(pathname: string): boolean {
  return !DOCS_SHELL_PATHS.has(pathname) && isServerPath(pathname);
}

/** Options for {@link createPluginMiddleware}. */
export interface PluginMiddlewareOptions {
  /** Overrides which paths are delegated to the Hono app. Defaults to {@link isServerPath}. */
  isServerPath?: (pathname: string) => boolean;
  /**
   * The plugin ships its own `src/pages/index.*`: Astro renders `/` (and the legacy `.html`
   * redirects) instead of the docs shell. Ignored when `isServerPath` is given.
   */
  ownIndexPage?: boolean;
  /**
   * Reject cross-site form-style submissions (403) to the requests left to Astro — the plugin's
   * own pages, endpoints and actions. The Hono-served routes are never checked: they are a
   * cross-origin API authorized by bearer tokens, not cookies. The integration enables this in
   * place of Astro's `security.checkOrigin`, which it turns off.
   */
  checkOrigin?: boolean;
  /**
   * `qrtl.config` `site.access: "user"`: the plugin's own pages need a sign-in. A request without
   * a valid page session is redirected to `/oauth/login?return_to=<page>`; with one, the session
   * (the person and their token, from `/oauth/session`) is put in `locals.qrtlSession`. The
   * `public` globs, widget pages and Astro's assets stay open.
   */
  pageAccess?: { public?: string[] };
}

/**
 * Creates an Astro `onRequest` middleware that delegates Quartal Plugin server routes to the Hono app
 * (`app.fetch`) and lets Astro render everything else. The app is built once, lazily.
 * @param app The Hono app or a factory returning it (from `getAnonApp`/`getAuthApp`).
 * @param options Path-matching options.
 */
export function createPluginMiddleware(
  app: Hono | (() => Hono | Promise<Hono>),
  options?: PluginMiddlewareOptions,
): MiddlewareOnRequest {
  const matches = options?.isServerPath ?? (options?.ownIndexPage ? isServerPathWithOwnIndexPage : isServerPath);
  let appPromise: Promise<Hono> | null = null;
  const getApp = (): Promise<Hono> => {
    if (!appPromise) appPromise = Promise.resolve(typeof app === "function" ? app() : app);
    return appPromise;
  };

  const publicPages = (options?.pageAccess?.public ?? []).map(pathGlobMatcher);
  const isOpenPage = (pathname: string) =>
    ALWAYS_OPEN.some((re) => re.test(pathname)) || publicPages.some((m) => m(pathname));

  return async (context, next) => {
    const url = context.url ?? new URL(context.request.url);
    if (!matches(url.pathname)) {
      if (options?.checkOrigin && !context.isPrerendered && isForbiddenCrossOriginRequest(context.request, url)) {
        return new Response(`Cross-site ${context.request.method} form submissions are forbidden`, { status: 403 });
      }
      if (options?.pageAccess && !context.isPrerendered && !isOpenPage(url.pathname)) {
        const honoApp = await getApp();
        const session = await honoApp.fetch(new Request(new URL("/oauth/session", url), {
          headers: { cookie: context.request.headers.get("cookie") ?? "" },
        }));
        if (!session.ok) {
          const login = new URL("/oauth/login", url);
          login.searchParams.set("return_to", url.pathname + url.search);
          return Response.redirect(login.toString(), 302);
        }
        if (context.locals) context.locals.qrtlSession = await session.json();
      }
      return next();
    }
    const honoApp = await getApp();
    return honoApp.fetch(context.request);
  };
}
