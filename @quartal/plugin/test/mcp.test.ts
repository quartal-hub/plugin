import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { PluginApiHelper, PluginMcpHelper } from "../src/index.ts";
import type { PluginAppConfig } from "../src/index.ts";

// End-to-end MCP test: serve the ported Hono app (API + MCP) via @hono/node-server under Node and
// drive it with the real MCP SDK client — the same shape as the original Deno test, no Deno.

const test1Dir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

// Local stand-in for @samples/test1/tools/Calculator.ts (matches its generated schema).
class Calculator {
  static add(input: { first: number; second: number }): number {
    return input.first + input.second;
  }
}

// The MCP tool id for Calculator.add, taken from the committed mcp-tools.json.
const mcpTools = JSON.parse(readFileSync(join(test1Dir, "qrtl-plugin/mcp-tools.json"), "utf-8")) as {
  tools: { id: string; className: string; methodName: string }[];
};
const addToolId = mcpTools.tools.find((t) => t.className === "Calculator" && t.methodName === "add")!.id;

let server: { close: () => void };
let baseUrl = "";

beforeAll(async () => {
  const config: PluginAppConfig = {
    pluginRootFolder: test1Dir,
    toolModules: { Calculator: { Calculator } as unknown as Record<string, unknown> },
  };
  const helper = new PluginApiHelper("/api", config);
  await helper.init();
  const app = helper.getApiApp();
  await PluginMcpHelper.applyToApp(app as unknown as Hono, helper, config);

  await new Promise<void>((resolve) => {
    server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, (info: { port: number }) => {
      baseUrl = `http://127.0.0.1:${info.port}`;
      resolve();
    }) as unknown as { close: () => void };
  });
});

afterAll(() => server?.close());

describe("PluginMcpHelper — MCP over Streamable HTTP (SDK client)", () => {
  it("lists tools (with generated input schema) and calls one end-to-end", async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    const client = new Client({ name: "hub-mcp-test", version: "0.0.1" }, { capabilities: {} });
    await client.connect(transport);
    try {
      const list = await client.listTools();
      const addTool = list.tools.find((t) => t.name === addToolId);
      expect(addTool, `tools/list should include ${addToolId}`).toBeDefined();
      const schema = addTool!.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
      expect(schema.properties?.first).toBeDefined();
      expect(schema.properties?.second).toBeDefined();
      expect(schema.required).toEqual(expect.arrayContaining(["first", "second"]));

      const call = await client.callTool({ name: addToolId, arguments: { first: 2, second: 3 } });
      const content = call.content as { type: string; text: string }[];
      expect(content[0]?.type).toBe("text");
      expect(JSON.parse(content[0].text)).toEqual({ value: 5 });
    } finally {
      await transport.close();
    }
  });
});
