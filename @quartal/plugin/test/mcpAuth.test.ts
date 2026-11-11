import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { Hono, type MiddlewareHandler } from "hono";
import { PluginApiHelper, PluginMcpHelper } from "../src/index.ts";
import type { PluginAppConfig } from "../src/index.ts";

// With a login (`auth.middleware`), the MCP list mirrors stay public for every server and the MCP
// protocol itself needs the login.

const test1Dir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

class Calculator {
  static add(input: { first: number; second: number }): number {
    return input.first + input.second;
  }
}

/** Stand-in for the OAuth middleware: a bearer token is required. */
const requireToken: MiddlewareHandler = async (c, next) => {
  if (c.req.header("authorization") !== "Bearer ok") {
    return c.json({ error: "Unauthorized (missing token)" }, 401);
  }
  await next();
};

const listFiles = ["tools.json", "prompts.json", "resources.json"];
const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "auth-test", version: "0.0.1" } },
};

let app: Hono;

beforeAll(async () => {
  const config: PluginAppConfig = {
    pluginRootFolder: test1Dir,
    toolModules: { Calculator: { Calculator } as unknown as Record<string, unknown> },
    mcp: { servers: { main: { tools: ["Calculator"] }, stats: { tools: ["HelloWorld"] } } },
    auth: { middleware: requireToken },
  };
  const helper = new PluginApiHelper("/api", config);
  await helper.init();
  app = helper.getApiApp() as unknown as Hono;
  await PluginMcpHelper.applyToApp(app, helper, config);
});

const post = (path: string, headers: Record<string, string> = {}) =>
  app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify(initialize),
  });

describe("PluginMcpHelper with a login", () => {
  it.each(["/mcp", "/mcp/stats"].flatMap((base) => listFiles.map((file) => `${base}/${file}`)))(
    "serves GET %s without a login",
    async (path) => {
      const res = await app.request(path);
      expect(res.status).toBe(200);
    },
  );

  it("serves the tool input schemas in the public tools.json", async () => {
    const body = await (await app.request("/mcp/tools.json")).json() as { tools: { inputSchema?: unknown }[] };
    expect(body.tools.length).toBeGreaterThan(0);
    expect(body.tools.every((t) => t.inputSchema)).toBe(true);
  });

  it.each(["/mcp", "/mcp/stats"])("requires a login for the MCP protocol at %s", async (path) => {
    expect((await post(path)).status).toBe(401);
    expect((await post(path, { authorization: "Bearer ok" })).status).toBe(200);
  });

  it("requires a login for other methods and paths under /mcp", async () => {
    expect((await post("/mcp/tools.json")).status).toBe(401);
    expect((await app.request("/mcp/other.json")).status).toBe(401);
    expect((await app.request("/mcp/unknown/tools.json")).status).toBe(401);
  });
});
