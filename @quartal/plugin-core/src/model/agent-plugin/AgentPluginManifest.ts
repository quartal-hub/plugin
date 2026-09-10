/** `$schema` of an Agent Plugins 1.0 `plugin.json` manifest. */
export const AGENT_PLUGIN_MANIFEST_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";

/** Reverse-domain extension namespace for Quartal-specific plugin data. */
export const QUARTAL_EXTENSION_NAMESPACE = "com.quartal.plugin";

/** Plugin author (Agent Plugins / npm `author` object form). */
export interface PluginAuthor {
  /** Author display name. */
  name: string;
  /** Contact email. */
  email?: string;
  /** Author URL. */
  url?: string;
}

/**
 * An [Agent Plugins 1.0](https://agent-plugins.org/specification) `plugin.json` manifest.
 * Served at `GET /plugin.json` and included in the installable package (`GET /plugin.zip`).
 */
export interface AgentPluginManifest {
  /** Always {@link AGENT_PLUGIN_MANIFEST_SCHEMA}. */
  $schema: string;
  /**
   * Plugin name: 1–64 chars, lowercase alphanumeric/hyphens/periods, alphanumeric start/end.
   * Derived from the npm package name (last segment, lowercased).
   */
  name: string;
  /** Plugin version (SemVer). */
  version?: string;
  /** Short description of the plugin. */
  description?: string;
  /** Plugin author. */
  author?: PluginAuthor;
  /** Primary public URL for the plugin. */
  homepage?: string;
  /** Source repository URL. */
  repository?: string;
  /** SPDX license id. */
  license?: string;
  /** Search keywords. */
  keywords?: string[];
  /** Client-specific extension data keyed by reverse-domain namespace. */
  extensions?: Record<string, Record<string, unknown>>;
}

/**
 * Quartal's `extensions["com.quartal.plugin"]` block: relative URLs to the Quartal surfaces the
 * Agent Plugins spec does not cover. Standard clients ignore the namespace; Quartal tooling and
 * the Quartal Hub read it.
 */
export interface QuartalPluginExtension {
  /** The REST API, described by its OpenAPI document. */
  api?: {
    /** URL of the OpenAPI 3 document. */
    openapi: string;
  };
  /** URL of the rich plugin overview (`contents.json`). */
  contents?: string;
  /** URL of the installable plugin package zip. */
  packageZip?: string;
  /** Tool ids that have an MCP Apps widget UI. */
  widgets?: string[];
}
