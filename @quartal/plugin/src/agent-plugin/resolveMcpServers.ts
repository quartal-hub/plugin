import type { McpServerOptions, PluginManifest } from "../model/index.ts";
import { mcpServerDisplayName } from "../hono-app/pluginMetadata.ts";

/** Valid MCP server config-key pattern (also used as a URL path segment under `/mcp/`). */
const SERVER_NAME_PATTERN = /^[a-z0-9_-]+$/;

/** A resolved local (hosted) MCP server: mounted at {@link path} on this plugin's origin. */
export interface ResolvedLocalMcpServer {
  /** Server name (`mcp.json` map key). */
  name: string;
  /** Mount path on the plugin origin: `/mcp` for the main server, `/mcp/<name>` otherwise. */
  path: string;
  /** Tool class names served; `undefined` = all tool classes. */
  tools?: string[];
  /** True for the server that also serves prompts and mounts at `/mcp`. */
  main: boolean;
  /** What this server exposes. */
  description?: string;
}

/** A resolved external MCP server: declared in `mcp.json`, never mounted or proxied. */
export interface ResolvedExternalMcpServer {
  /** Server name (`mcp.json` map key). */
  name: string;
  /** Absolute URL of the external MCP endpoint. */
  url: string;
  /** Extra HTTP headers clients should send. */
  headers?: Record<string, string>;
  /** What this server exposes. */
  description?: string;
}

/** The plugin's MCP servers resolved from `qrtl.config` options. */
export interface ResolvedMcpServers {
  /** Hosted servers, main first. */
  local: ResolvedLocalMcpServer[];
  /** External servers (config order). */
  external: ResolvedExternalMcpServer[];
}

/**
 * Resolves the plugin's MCP servers from its options. Without a `servers` map the plugin has one
 * server with every tool at `/mcp`, named after the plugin (or `options.name`). With a `servers`
 * map, the entry named `main` (or the first local entry) becomes the main server at `/mcp`; other
 * local entries mount at `/mcp/<name>`; `external` entries are declaration-only.
 * @param manifest Plugin manifest (default server name).
 * @param options MCP options from `qrtl.config` / `PluginAppConfig`.
 */
export function resolveMcpServers(manifest: PluginManifest, options?: McpServerOptions): ResolvedMcpServers {
  const servers = options?.servers;
  if (!servers || Object.keys(servers).length === 0) {
    return {
      local: [{ name: mcpServerDisplayName(manifest.name, options?.name), path: "/mcp", main: true }],
      external: [],
    };
  }

  const local: ResolvedLocalMcpServer[] = [];
  const external: ResolvedExternalMcpServer[] = [];
  for (const [name, def] of Object.entries(servers)) {
    if (!SERVER_NAME_PATTERN.test(name)) {
      throw new Error(`Invalid MCP server name "${name}": use lowercase letters, digits, "-" and "_".`);
    }
    if (def.external) {
      if (def.tools) {
        throw new Error(`MCP server "${name}" cannot set both "external" and "tools".`);
      }
      external.push({
        name,
        url: def.external.url,
        ...(def.external.headers ? { headers: def.external.headers } : {}),
        ...(def.description ? { description: def.description } : {}),
      });
      continue;
    }
    local.push({
      name,
      path: `/mcp/${name}`,
      main: false,
      ...(def.tools ? { tools: def.tools } : {}),
      ...(def.description ? { description: def.description } : {}),
    });
  }

  // The main server serves at `/mcp` (and also carries the prompts): the entry named "main",
  // falling back to the first local entry.
  const main = local.find((s) => s.name === "main") ?? local[0];
  if (main) {
    main.main = true;
    main.path = "/mcp";
    local.sort((a, b) => Number(b.main) - Number(a.main));
  }
  return { local, external };
}
