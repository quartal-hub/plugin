/** `$schema` of an Agent Plugins 1.0 `mcp.json` document. */
export const AGENT_PLUGIN_MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";

/**
 * A remote MCP server connection. `streamable-http` is the Agent Plugins / MCP standard type;
 * `http` is the same transport under the name Claude Code's `.mcp.json` uses; `sse` is the legacy
 * 2024-11-05 transport.
 */
export interface McpRemoteServerConfig {
  /** Transport type. */
  type: "streamable-http" | "http" | "sse";
  /** Absolute URL of the MCP endpoint (HTTPS required for non-loopback hosts). */
  url: string;
  /** Extra HTTP headers sent with every request. */
  headers?: Record<string, string>;
}

/** A local MCP server launched as a subprocess (Agent Plugins `stdio` type). */
export interface McpStdioServerConfig {
  /** Transport type. */
  type: "stdio";
  /** Executable to launch (a single token, not shell syntax). */
  command: string;
  /** Command arguments. */
  args?: string[];
  /** Environment variables for the subprocess. */
  env?: Record<string, string>;
  /** Working directory (defaults to the plugin root). */
  cwd?: string;
}

/** One MCP server entry in an `mcp.json` / `.mcp.json` document. */
export type McpServerConfig = McpRemoteServerConfig | McpStdioServerConfig;

/**
 * An MCP server configuration document: the Agent Plugins 1.0 `mcp.json` (with `$schema`) or
 * Claude Code's `.mcp.json` (same `mcpServers` map, no `$schema`, remote type `http`).
 * Served at `GET /mcp.json`.
 */
export interface McpServersConfig {
  /** {@link AGENT_PLUGIN_MCP_SCHEMA} in the standard document; omitted in the Claude variant. */
  $schema?: string;
  /** MCP servers keyed by name — the plugin's own hosted servers and any external ones. */
  mcpServers: Record<string, McpServerConfig>;
}
