import type { Hono } from "hono";
import type { Implementation } from "@modelcontextprotocol/server";
import type { McpServerOptions } from "../model/index.ts";
import { QUARTAL_EXTENSION_NAMESPACE } from "../model/index.ts";
import type { PluginApiHelper } from "./PluginApiHelper.ts";
import {
  buildAgentPluginManifest,
  buildQuartalExtension,
} from "../agent-plugin/buildAgentPluginManifest.ts";
import { buildMcpServersConfig } from "../agent-plugin/buildMcpServersConfig.ts";
import { buildAgentPluginZip } from "../agent-plugin/buildAgentPluginZip.ts";

/** Dependencies of the plugin-info routes beyond the shared helper. */
export interface PluginInfoRouteOptions {
  /** MCP options (`qrtl.config` `mcp`) — the servers listed in `mcp.json`. */
  mcpOptions?: McpServerOptions;
  /** Plugin root folder (skills/agents/README packaged into `plugin.zip`). */
  pluginRootFolder?: string;
  /** Builds the MCP server implementation for a request origin (`/mcp-server.json`). */
  getMcpServer: (origin: string) => Implementation;
}

/**
 * Registers the plugin's metadata endpoints, mirroring the installable Agent Plugins package:
 * `GET /plugin.json` (Agent Plugins 1.0 manifest), `GET /mcp.json` (standard MCP server config),
 * `GET /plugin.zip` (the whole installable package), the Quartal overview at
 * `GET /com.quartal.plugin/contents.json`, and `GET /mcp-server.json` (MCP implementation +
 * declared capabilities).
 * @param app Hono app to register routes on.
 * @param helper Shared hub API helper.
 * @param options Route dependencies (MCP options, plugin root, server-info builder).
 */
export function registerPluginInfoRoutes(
  app: Hono,
  helper: PluginApiHelper,
  options: PluginInfoRouteOptions,
): void {
  const manifest = helper.manifest!;
  const widgetToolIds = () => helper.widgetCatalog.map((w) => w.toolId);

  // The Agent Plugins 1.0 manifest — the same document as the packaged `plugin.json`.
  app.get("/plugin.json", (c) => {
    const origin = new URL(c.req.url).origin;
    return c.json(buildAgentPluginManifest(manifest, origin, buildQuartalExtension(widgetToolIds())));
  });

  // The standard `mcp.json`: hosted servers on this origin plus declared external servers.
  app.get("/mcp.json", (c) => {
    const origin = new URL(c.req.url).origin;
    return c.json(buildMcpServersConfig(manifest, options.mcpOptions, origin, "standard"));
  });

  // The rich Quartal overview (the generated `contents.json`), under the extension namespace so it
  // can never be confused with a standard document.
  app.get(`/${QUARTAL_EXTENSION_NAMESPACE}/contents.json`, async (c) => {
    const origin = new URL(c.req.url).origin;
    return c.json(await helper.getPluginInfo(origin));
  });

  // The whole installable Agent Plugin (manifests + skills + agents + overview), assembled per
  // request so the `mcp.json` URLs match the requesting origin.
  app.get("/plugin.zip", async (c) => {
    const origin = new URL(c.req.url).origin;
    const zip = await buildAgentPluginZip({
      manifest,
      mcpOptions: options.mcpOptions,
      origin,
      pluginInfo: await helper.getPluginInfo(origin),
      pluginRootFolder: options.pluginRootFolder ?? process.cwd(),
      widgetToolIds: widgetToolIds(),
    });
    return c.body(new Uint8Array(zip), 200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${manifest.name.split("/").pop()?.replace(/^@/, "") ?? "plugin"}.zip"`,
    });
  });

  app.get("/mcp-server.json", (c) => {
    const origin = new URL(c.req.url).origin;
    const capabilities: Record<string, unknown> = { tools: {}, logging: {} };
    if (helper.widgetCatalog.length > 0) capabilities.resources = {};
    if (helper.mcpPrompts.length > 0) capabilities.prompts = {};
    return c.json({ ...options.getMcpServer(origin), capabilities });
  });
}
