import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { PluginApiHelper, PluginMcpHelper } from "../src/index.ts";
import type { PluginAppConfig } from "../src/index.ts";

// End-to-end MCP test: serve the Hono app (API + MCP) via @hono/node-server and drive it with the
// real MCP SDK client.

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
      // Output schemas are relaxed (nullable leaves, open objects, no `required`) so that real API
      // results always pass the SDK client's structuredContent validation.
      const outputSchema = addTool!.outputSchema as {
        type?: string;
        properties?: Record<string, unknown>;
        required?: string[];
        additionalProperties?: boolean;
      };
      expect(outputSchema?.type).toBe("object");
      expect(outputSchema?.properties?.value).toEqual(expect.objectContaining({ type: ["number", "null"] }));
      expect(outputSchema?.required).toBeUndefined();
      expect(outputSchema?.additionalProperties).toBe(true);

      // `@visibility app` on Calculator.multiply is advertised as MCP Apps `_meta.ui.visibility`;
      // an untagged tool without a widget gets no `_meta` at all.
      const multiplyToolId = mcpTools.tools.find((t) => t.className === "Calculator" && t.methodName === "multiply")!.id;
      const multiplyTool = list.tools.find((t) => t.name === multiplyToolId);
      expect((multiplyTool?._meta as { ui?: { visibility?: string[] } } | undefined)?.ui?.visibility).toEqual(["app"]);
      expect(addTool!._meta).toBeUndefined();

      // The SDK client validates structuredContent against the advertised outputSchema, so a
      // successful call also proves the schema and the wrapped `{ value }` result agree.
      const call = await client.callTool({ name: addToolId, arguments: { first: 2, second: 3 } });
      expect(call.structuredContent).toEqual({ value: 5 });
      const content = call.content as { type: string; text: string }[];
      expect(content[0]?.type).toBe("text");
      expect(JSON.parse(content[0].text)).toEqual({ value: 5 });
    } finally {
      await transport.close();
    }
  });

  // Pinned negotiation has no fallback: connect() itself proves the server serves the modern
  // (2026-07-28, per-request envelope) era via createMcpHandler, not just the legacy fallback.
  it("serves the 2026-07-28 era to a version-pinned client", async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    const client = new Client(
      { name: "hub-mcp-test-modern", version: "0.0.1" },
      { capabilities: {}, versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    await client.connect(transport);
    try {
      expect(client.getNegotiatedProtocolVersion()).toBe("2026-07-28");
      const list = await client.listTools();
      expect(list.tools.some((t) => t.name === addToolId)).toBe(true);
      const call = await client.callTool({ name: addToolId, arguments: { first: 2, second: 3 } });
      expect(call.structuredContent).toEqual({ value: 5 });
    } finally {
      await transport.close();
    }
  });
});
