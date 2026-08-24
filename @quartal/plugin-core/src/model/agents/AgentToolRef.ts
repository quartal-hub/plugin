/** Where a tool named by an agent comes from. */
export type AgentToolKind =
  /** A tool of the plugin that ships the agent (matched against the plugin's MCP tool ids). */
  | "plugin"
  /** A tool the host environment is expected to provide (`Read`, `Grep`, `WebFetch`, …). */
  | "environment"
  /** A tool of an MCP server the agent declares (`mcp__<server>__<tool>`). */
  | "mcp"
  /** A wildcard pattern such as `mcp__*`. */
  | "pattern"
  /** A name that matches nothing known — passed through untouched. */
  | "unknown";

/**
 * One entry of an agent's `tools` / `disallowedTools` list, resolved against the plugin's own
 * tools, the known environment tools and the agent's MCP servers.
 *
 * Names are kept verbatim so a host can forward them as authored; `kind` tells the host where to
 * look the tool up.
 */
export interface AgentToolRef {
  /** Tool name exactly as authored. */
  name: string;
  /** Where the tool is expected to come from. */
  kind: AgentToolKind;
  /** MCP tool id in the plugin that ships the agent (set when `kind` is `plugin`). */
  toolId?: string;
  /** MCP server name (set when `kind` is `mcp`). */
  server?: string;
  /** Tool name on the MCP server, without the `mcp__<server>__` prefix (set when `kind` is `mcp`). */
  serverTool?: string;
}
