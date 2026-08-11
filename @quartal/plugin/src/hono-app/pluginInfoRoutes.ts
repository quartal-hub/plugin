import type { Hono } from "hono";
import type { Implementation } from "@modelcontextprotocol/sdk/types.js";
import type { PluginApiHelper } from "./PluginApiHelper.ts";

/** Registers `GET /plugin.json` (overview) and `GET /mcp-server.json`.
 * @param app Hono app to register routes on.
 * @param helper Shared hub API helper.
 * @param getMcpServer Builds the MCP server implementation for a request origin.
 */
export function registerPluginInfoRoutes(
  app: Hono,
  helper: PluginApiHelper,
  getMcpServer: (origin: string) => Implementation,
): void {
  // Served from the generated `contents.json`. Routed at `/plugin.json` so it can never be confused
  // with (or shadowed by) the project's own npm `package.json`.
  app.get("/plugin.json", async (c) => {
    const origin = new URL(c.req.url).origin;
    return c.json(await helper.getPluginInfo(origin));
  });

  app.get("/mcp-server.json", (c) => {
    const origin = new URL(c.req.url).origin;
    return c.json(getMcpServer(origin));
  });
}
