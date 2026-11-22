import type { PluginAuthor, WidgetCsp } from "@quartal/plugin-core";
import type { McpServerOptions } from "./web-app/McpServerOptions.ts";

/**
 * Auth mode: `"anon"` (no authentication), `"quartal-hub"` (OAuth2 via Quartal Hub — zero-config,
 * test environment), or `"custom"` (own OAuth2/OIDC server via `OAUTH_*` env vars).
 */
export type QrtlAuthMode = "anon" | "quartal-hub" | "custom";

/**
 * Object form of the `auth` config: the mode plus app-default OAuth values. The values here are
 * the application defaults — the corresponding `OAUTH_*` environment variables still override
 * them at runtime (config < env < programmatic `OAuthOptions`). Values that identify the
 * deployment environment rather than the app (JWKS URI, token URL, client id) are deliberately
 * not configurable here; use the env vars for those.
 */
export interface QrtlAuthConfig {
  /** Auth mode; picks the fallback defaults for the values not set here. */
  mode: QrtlAuthMode;
  /** OAuth/OIDC issuer URL (env override: `OAUTH_ISSUER`). */
  issuer?: string;
  /** Scope(s) this plugin requires (env override: `OAUTH_SCOPE`, space-separated). */
  scope?: string | string[];
  /** Expected `aud` claim value(s) on access tokens (env override: `OAUTH_AUDIENCE`). */
  audience?: string | string[];
  /** Canonical URI of this resource server, RFC 8707/9728 (env override: `OAUTH_RESOURCE`). */
  resource?: string;
}

/**
 * What the plugin's web site serves to browsers: its start page and who may open its pages.
 * The machine routes (`/mcp`, `/api/*`, `/plugin.json`, …) are not affected.
 */
export interface QrtlSiteConfig {
  /**
   * What `/` serves: `"docs"` (default) the docs site; `"pages"` the plugin's own pages
   * (`src/pages/index.*`), with no docs site; or `{ redirect }` a redirect to a page elsewhere,
   * e.g. the plugin's page in a catalog. `{name}` in the URL is replaced with the plugin's name
   * and `{origin}` with its origin, both URL-encoded.
   */
  root?: "docs" | "pages" | { redirect: string };
  /**
   * Who may open the plugin's own pages (`src/pages/**`): `"anon"` (default) anyone; `"user"` a
   * person signed in with the plugin's `auth`. Requires an `auth` mode other than `"anon"`. A page
   * reads the signed-in person from `Astro.locals.qrtlSession`.
   */
  access?: "anon" | "user";
  /**
   * With `access: "user"`, the pages anyone may open: path globs, `*` within one segment and `**`
   * across segments (e.g. `["/register/**"]`). Widget pages are always open: MCP clients load them.
   */
  public?: string[];
}

/**
 * Quartal Plugin configuration (`qrtl.config.ts` / `.js` / `.mjs` / `.json`) — the single place to
 * configure a plugin: identity, visual style, MCP options, auth mode, deploy target, and widget CSP.
 * Every identity field defaults from the corresponding `package.json` field; a value here takes
 * precedence. Author it with a `defineQrtlConfig({...})` default export.
 */
export interface QrtlConfig {
  /** Plugin name (defaults to `package.json#name`). */
  name?: string;
  /** End-user-friendly title shown in docs and MCP (defaults to a title derived from the name). */
  title?: string;
  /** Short description (defaults to `package.json#description`). */
  description?: string;
  /** Plugin version (defaults to `package.json#version`). */
  version?: string;
  /** License identifier, e.g. `MIT` (defaults to `package.json#license`). */
  license?: string;
  /** Primary public URL for the plugin (defaults to `package.json#homepage`). */
  homepage?: string;
  /**
   * Plugin author — npm's string shorthand (`"Name <email> (url)"`) or object form (defaults to
   * `package.json#author`).
   */
  author?: string | PluginAuthor;
  /**
   * Source repository — npm's string shorthand (the URL) or object form (defaults to
   * `package.json#repository`).
   */
  repository?: string | { type?: string; url: string; directory?: string };
  /** Search keywords (defaults to `package.json#keywords`). */
  keywords?: string[];
  /** Visual elements for documentation and plugin listings. */
  style?: {
    /** Front-page/documentation logo URL (≥300px wide). Defaults to the Quartal logo. */
    logo?: string;
    /** Bootstrap skin CSS URL (CDN) injected into the docs SPA shell. */
    skin?: string;
    /** Icons (MCP schema); bytes are served from `/icons/{index}`. */
    icons?: Array<Record<string, unknown>>;
  };
  /** MCP server options, or `false` to disable the MCP server. */
  mcp?: McpServerOptions | boolean;
  /**
   * Auth mode (default `"anon"`), either the mode string alone or the object form
   * ({@link QrtlAuthConfig}) that also sets app-default OAuth values (issuer, scope, audience,
   * resource). `OAUTH_*` env vars override the object's values at runtime.
   */
  auth?: QrtlAuthMode | QrtlAuthConfig;
  /** The web site: start page and page access ({@link QrtlSiteConfig}). */
  site?: QrtlSiteConfig;
  /** Deployment target metadata (org/app), used by deploy tooling. */
  deploy?: { org?: string; app?: string };
  /** Shared and per-widget CSP for the sandboxed MCP Apps iframes. */
  widgets?: {
    /** CSP applied to every widget. */
    csp?: WidgetCsp;
    /** Per-widget overrides keyed by tool id: `name` is the widget's display title (defaults to the tool's title). */
    entries?: Record<string, { name?: string; csp?: WidgetCsp }>;
  };
}

/** Identity helper for authoring a typed `qrtl.config.ts` (`export default defineQrtlConfig({...})`). */
export function defineQrtlConfig(config: QrtlConfig): QrtlConfig {
  return config;
}

/** Normalizes a `QrtlConfig.auth` value (mode string, object form, or unset) to {@link QrtlAuthConfig}. */
export function toQrtlAuthConfig(auth: QrtlAuthMode | QrtlAuthConfig | undefined): QrtlAuthConfig {
  if (!auth) return { mode: "anon" };
  return typeof auth === "string" ? { mode: auth } : auth;
}
