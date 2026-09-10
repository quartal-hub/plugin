import type { McpServerOptions, McpServersConfig, PluginManifest, PluginMcpServerEntry } from "../model/index.ts";
import { AGENT_PLUGIN_MCP_SCHEMA } from "../model/index.ts";
import { resolveMcpServers } from "./resolveMcpServers.ts";

/**
 * Builds the MCP server configuration document: the Agent Plugins 1.0 `mcp.json` (served at
 * `GET /mcp.json`) or Claude Code's `.mcp.json` variant. Hosted servers point at this plugin's
 * origin; external servers keep their original URL.
 * @param manifest Resolved plugin manifest.
 * @param options MCP options (`qrtl.config` `mcp`).
 * @param origin Absolute origin the hosted servers are reachable on.
 * @param variant `standard` (`$schema` + `streamable-http`) or `claude` (no `$schema`, type `http`).
 */
export function buildMcpServersConfig(
  manifest: PluginManifest,
  options: McpServerOptions | undefined,
  origin: string,
  variant: "standard" | "claude" = "standard",
): McpServersConfig {
  const { local, external } = resolveMcpServers(manifest, options);
  const remoteType = variant === "claude" ? "http" : "streamable-http";
  const mcpServers: McpServersConfig["mcpServers"] = {};
  for (const server of local) {
    mcpServers[server.name] = { type: remoteType, url: `${origin}${server.path}` };
  }
  for (const server of external) {
    mcpServers[server.name] = {
      type: remoteType,
      url: server.url,
      ...(server.headers ? { headers: server.headers } : {}),
    };
  }
  return {
    ...(variant === "standard" ? { $schema: AGENT_PLUGIN_MCP_SCHEMA } : {}),
    mcpServers,
  };
}

/**
 * Summarizes the plugin's MCP servers for the overview (`contents.json` `mcpServers`). Hosted
 * servers use origin-relative URLs; external servers keep their absolute URL.
 * @param manifest Resolved plugin manifest.
 * @param options MCP options (`qrtl.config` `mcp`).
 * @param countTools Returns the number of tools a local server serves (given its class filter).
 */
export function buildMcpServerEntries(
  manifest: PluginManifest,
  options: McpServerOptions | undefined,
  countTools: (toolClasses?: string[]) => number,
): PluginMcpServerEntry[] {
  const { local, external } = resolveMcpServers(manifest, options);
  return [
    ...local.map((s) => ({
      name: s.name,
      url: s.path,
      toolCount: countTools(s.tools),
      ...(s.description ? { description: s.description } : {}),
    })),
    ...external.map((s) => ({
      name: s.name,
      url: s.url,
      external: true,
      ...(s.description ? { description: s.description } : {}),
    })),
  ];
}
