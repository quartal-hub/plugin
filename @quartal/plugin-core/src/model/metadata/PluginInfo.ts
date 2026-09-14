import type { PluginLinks } from "./PluginLinks.ts";
import type { PluginManifest } from "./PluginManifest.ts";
import type { McpCatalogEntry } from "../mcp/McpCatalog.ts";
import type {
  PluginAgentSummary,
  PluginMcpServerEntry,
  PluginPromptEntry,
  PluginSkillSummary,
  PluginToolEntry,
  PluginToolGroup,
  PluginWidgetEntry,
} from "./PluginOverview.ts";

/**
 * Unified plugin overview (the generated `contents.json`), served at
 * `GET /com.quartal.plugin/contents.json`.
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
  /** Agents shipped with the plugin (details via {@link PluginLinks.agentsCatalog}). */
  agents: PluginAgentSummary[];
  /** MCP widget UIs registered for tools. */
  widgets: PluginWidgetEntry[];
  /** MCP resources exposed by this plugin (currently often empty). */
  resources: McpCatalogEntry[];
  /** MCP prompts exposed by this plugin (prompt-class functions from `src/prompts/`). */
  prompts: PluginPromptEntry[];
  /** MCP servers of this plugin: hosted (relative URL) and external (absolute URL). */
  mcpServers: PluginMcpServerEntry[];
  /** Relative URLs to detailed metadata endpoints. */
  links: PluginLinks;
}
