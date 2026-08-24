import type { AgentColor } from "../agents/AgentColor.ts";
import type { PromptArgument } from "../mcp/McpPrompt.ts";

/** A tool parameter or return slot with a type reference resolvable via `links.types`. */
export interface PluginToolParameter {
  /** Parameter or return slot name (empty for anonymous return). */
  name: string;
  /** Parameter or return description from JSDoc. */
  description: string;
  /** Named type id (see `links.types`) or inline primitive type name. */
  type: string;
  /** If true, the parameter is optional. */
  optional?: boolean;
  /** If true, the parameter may be null. */
  nullable?: boolean;
}

/** Where a tool is exposed (MCP and/or REST). */
export interface PluginToolExposure {
  /** MCP tool id when listed in MCP `tools/list`; omitted when not exposed via MCP. */
  mcpName?: string;
  /** REST path relative to the server origin when exposed via OpenAPI; omitted when not available. */
  restUrl?: string;
  /** HTTP method for the REST route (when {@link PluginToolExposure.restUrl} is set). */
  restMethod?: "get" | "post" | "put" | "delete" | "patch";
}

/** Tools grouped by source class (OpenAPI tag / MCP grouping). */
export interface PluginToolGroup {
  /** Source class name. */
  className: string;
  /** Source file stem (without `.ts`). */
  fileName: string;
  /** Methods defined on this class. */
  tools: PluginToolEntry[];
}

/** One executable tool (class method) exposed by the plugin. */
export interface PluginToolEntry {
  /** Method name on the source class. */
  name: string;
  /** Source class name. */
  className: string;
  /** Source file stem (without `.ts`). */
  fileName: string;
  /** Short summary from `@summary` JSDoc. */
  summary?: string;
  /** Longer description from JSDoc. */
  description: string;
  /** Request parameters (typically one object parameter). */
  parameters: PluginToolParameter[];
  /** Response type and description. */
  returns: PluginToolParameter;
  /** MCP and REST exposure details. */
  exposure: PluginToolExposure;
  /** Whether an MCP Apps widget UI is registered for this tool. */
  hasWidget: boolean;
}

/** One MCP prompt (prompt-class function) exposed by the plugin. */
export interface PluginPromptEntry {
  /** MCP prompt name advertised in `prompts/list`. */
  name: string;
  /** Source class name. */
  className: string;
  /** Source file stem (without `.ts`). */
  fileName: string;
  /** Source method name on the class. */
  methodName: string;
  /** Short summary from `@summary` JSDoc. */
  summary?: string;
  /** Longer description from JSDoc. */
  description: string;
  /** Arguments accepted by the prompt (string-valued on the MCP wire). */
  arguments: PromptArgument[];
}

/** Skill summary for the plugin overview (file list loaded from `links.skillsCatalog`). */
export interface PluginSkillSummary {
  /** Skill identifier (directory name under `skills/`). */
  name: string;
  /** Short description from SKILL.md frontmatter. */
  description: string;
  /** SPDX license identifier or license text. */
  license?: string;
  /** Runtime or environment compatibility notes. */
  compatibility?: string;
  /** Arbitrary key/value metadata from frontmatter. */
  metadata?: Record<string, unknown>;
  /** Number of files bundled with the skill. */
  fileCount: number;
}

/** Agent summary for the plugin overview (full definition via `links.agentsCatalog`). */
export interface PluginAgentSummary {
  /** Agent identifier (file stem under `agents/`). */
  name: string;
  /** What the agent is for and when a host should delegate to it. */
  description: string;
  /** Canonical `provider/model` id, or `inherit`; omitted when the agent names no model. */
  model?: string;
  /** Accent color resolved for Claude, Bootstrap and CSS hosts. */
  color?: AgentColor;
  /** Number of tools the agent is limited to; omitted when it may use everything the host offers. */
  toolCount?: number;
  /** Skills of this plugin the agent preloads. */
  skills?: string[];
}

/** Widget summary linked to an MCP tool. */
export interface PluginWidgetEntry {
  /** Display name from `vue/widgets.json`. */
  name: string;
  /** MCP widget title (typically the tool id). */
  title: string;
  /** Widget description (from MCP catalog when available). */
  description: string;
  /** MCP tool id this widget visualizes. */
  toolId: string;
  /** MCP Apps resource URI for the widget HTML. */
  resourceUri: string;
}
