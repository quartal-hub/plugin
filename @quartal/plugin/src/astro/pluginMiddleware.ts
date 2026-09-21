import type { Hono } from "hono";

/** Minimal structural subset of Astro's middleware context (only what this middleware reads). */
export interface AstroMiddlewareContext {
  request: Request;
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
  "/mcp-server.json",
  "/open-api.json",
  "/types.json",
  "/readme.md",
  "/mcp.html",
  "/swagger.html",
  "/docs.html",
  "/skills.html",
  "/agents.html",
]);

/**
 * The human-facing docs paths: the shell at `/` and the legacy redirects into its hash routes.
 * Released to Astro when the plugin ships its own `src/pages/index.*` — the machine routes
 * (`/plugin.json`, `/mcp`, `/api/*`, …) always stay with the Hono app.
 */
const DOCS_SHELL_PATHS = new Set(["/", "/mcp.html", "/swagger.html", "/docs.html", "/skills.html", "/agents.html"]);

/**
 * Whether a request path is served by the Hono app (REST/MCP/skills/agents/icons/docs-SPA/…)
 * rather than by an Astro page. Astro keeps everything else — widget pages (`/widgets/*`), its own
 * assets (`/_astro/*`, `/_image`), user pages, etc.
 * @param pathname URL pathname.
 */
export function isServerPath(pathname: string): boolean {
  if (SERVER_EXACT.has(pathname)) return true;
  return SERVER_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
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

  return async (context, next) => {
    const { pathname } = new URL(context.request.url);
    if (!matches(pathname)) return next();
    const honoApp = await getApp();
    return honoApp.fetch(context.request);
  };
}
