import type { PluginLinks } from "./PluginLinks.ts";
import type { PluginManifest } from "./PluginManifest.ts";
import type { McpCatalogEntry } from "../mcp/McpCatalog.ts";
import type {
  PluginPromptEntry,
  PluginSkillSummary,
  PluginToolEntry,
  PluginToolGroup,
  PluginWidgetEntry,
} from "./PluginOverview.ts";

/**
 * Unified plugin overview served at `GET /plugin.json`.
 */
export interface PluginInfo extends PluginManifest {
  /** Whether a readme is available at {@link PluginLinks.readme}. */
  hasReadme: boolean;
  /** Tools exposed by this plugin (MCP and REST). */
  tools: PluginToolEntry[];
  /** Tools grouped by source class for navigation and docs. */
  toolGroups: PluginToolGroup[];
  /** Agent skills shipped with the plugin (details via {@link PluginLinks.skillsCatalog}). */
  skills: PluginSkillSummary[];
  /** MCP widget UIs registered for tools. */
  widgets: PluginWidgetEntry[];
  /** MCP resources exposed by this plugin (currently often empty). */
  resources: McpCatalogEntry[];
  /** MCP prompts exposed by this plugin (prompt-class functions from `src/prompts/`). */
  prompts: PluginPromptEntry[];
  /** Relative URLs to detailed metadata endpoints. */
  links: PluginLinks;
}
