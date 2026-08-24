import type { AgentDefinition } from "./AgentDefinition.ts";

/** Manifest served at `/agents/catalog.json` before URL enrichment. */
export interface AgentsCatalog {
  /** Catalog schema version. */
  version: "1.0";
  /** Plugin name (e.g. `@samples/my-plugin`). */
  plugin: string;
  /** Agents exposed by this plugin. */
  agents: AgentDefinition[];
}

/** Absolute URLs for an agent entry, added at serve time. */
export interface AgentCatalogUrls {
  /** URL to the agent as Claude-format markdown (frontmatter + system prompt). */
  markdown: string;
  /** URL to the resolved agent definition as JSON. */
  json: string;
  /** URL to the rendered HTML documentation page. */
  html: string;
}

/** One agent entry with absolute URLs added at serve time. */
export interface AgentCatalogEntry extends AgentDefinition {
  /** Absolute URLs for common agent resources. */
  urls: AgentCatalogUrls;
}

/** Response for `GET /agents/catalog.json`. */
export interface AgentsCatalogResponse {
  /** Catalog schema version. */
  version: "1.0";
  /** Plugin name (e.g. `@samples/my-plugin`). */
  plugin: string;
  /** Agents with enriched URLs. */
  agents: AgentCatalogEntry[];
}
