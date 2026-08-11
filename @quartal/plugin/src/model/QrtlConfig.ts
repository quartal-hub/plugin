import type { McpServerOptions } from "./web-app/McpServerOptions.ts";
import type { WidgetCsp } from "./index.ts";

/**
 * Quartal Plugin configuration (`qrtl.config.ts` / `.js` / `.mjs` / `.json`). Holds the Quartal
 * metadata that `package.json` has no place for — title, visual style, MCP options, auth mode, deploy
 * target, and widget CSP. Combined with `package.json` (name/version/description/license/…) it fully
 * describes the plugin. Author it with a `defineQrtlConfig({...})` default export.
 */
export interface QrtlConfig {
  /** Overrides the plugin name (defaults to `package.json#name`). */
  name?: string;
  /** End-user-friendly title shown in docs and MCP (defaults to a title derived from the name). */
  title?: string;
  /** Short description (defaults to `package.json#description`). */
  description?: string;
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
  /** Auth mode: `"anon"` (default) or `"quartal-iam"` (Keycloak / OIDC JWT bearer). */
  auth?: "anon" | "quartal-iam";
  /** Deployment target metadata (org/app), used by deploy tooling. */
  deploy?: { org?: string; app?: string };
  /** Shared and per-widget CSP for the sandboxed MCP Apps iframes. */
  widgets?: {
    /** CSP applied to every widget. */
    csp?: WidgetCsp;
    /** Per-widget overrides keyed by tool id. */
    entries?: Record<string, { name?: string; csp?: WidgetCsp }>;
  };
}

/** Identity helper for authoring a typed `qrtl.config.ts` (`export default defineQrtlConfig({...})`). */
export function defineQrtlConfig(config: QrtlConfig): QrtlConfig {
  return config;
}
