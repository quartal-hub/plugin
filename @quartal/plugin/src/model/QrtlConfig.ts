import type { PluginAuthor, WidgetCsp } from "@quartal/plugin-core";
import type { McpServerOptions } from "./web-app/McpServerOptions.ts";

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
