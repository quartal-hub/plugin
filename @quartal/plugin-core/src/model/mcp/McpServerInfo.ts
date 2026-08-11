import type { PluginIcon } from "../metadata/PluginIcon.ts";

/** MCP server metadata served at `GET /mcp-server.json`. */
export interface McpServerInfo {
  /** MCP server identifier (typically the plugin name). */
  name: string;
  /** Human-readable display name. */
  title?: string;
  /** Server version string. */
  version: string;
  /** Longer description of the MCP server. */
  description?: string;
  /** Public website URL for the product or plugin. */
  websiteUrl?: string;
  /** Icons for MCP clients (same schema as plugin icons). */
  icons?: PluginIcon[];
}
