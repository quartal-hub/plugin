import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { INVALID_PARAMS, ProtocolError } from "@modelcontextprotocol/server";
import { PluginApiHelper, PluginMcpHelper } from "../src/index.ts";
import type { PluginAppConfig } from "../src/index.ts";

// MCP error semantics end-to-end (spec: https://modelcontextprotocol.io — Tools, "Error Handling"):
// - unknown tool and invalid arguments are PROTOCOL errors (JSON-RPC -32602 Invalid params);
// - errors thrown by the tool itself are TOOL EXECUTION errors, reported inside the result with
//   `isError: true` (and no `structuredContent`, which must conform to the outputSchema).

const test1Dir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

// Stand-in for the fixture Calculator: `add` works, `multiply` throws (the execution-error case).
class Calculator {
  static add(input: { first: number; second: number }): number {
    return input.first + input.second;
  }

  multiply(_input: { first: number; second: number }): number {
    throw new Error("Deliberate failure from multiply");
  }
}

const mcpTools = JSON.parse(readFileSync(join(test1Dir, "qrtl-plugin/mcp-tools.json"), "utf-8")) as {
  tools: { id: string; className: string; methodName: string }[];
};
const addToolId = mcpTools.tools.find((t) => t.className === "Calculator" && t.methodName === "add")!.id;
const multiplyToolId = mcpTools.tools.find((t) => t.className === "Calculator" && t.methodName === "multiply")!.id;

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

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
  const client = new Client({ name: "mcp-errors-test", version: "0.0.1" }, { capabilities: {} });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await transport.close();
  }
}

describe("PluginMcpHelper — MCP error semantics", () => {
  it("rejects an unknown tool with a -32602 protocol error", async () => {
    await withClient(async (client) => {
      const error = await client.callTool({ name: "no-such-tool", arguments: {} }).then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(ProtocolError);
      expect((error as ProtocolError).code).toBe(INVALID_PARAMS);
      expect((error as ProtocolError).message).toContain("Unknown tool");
    });
  });

  it("rejects invalid arguments with a -32602 protocol error carrying Zod details", async () => {
    await withClient(async (client) => {
      const error = await client
        .callTool({ name: addToolId, arguments: { first: "not-a-number", second: 3 } })
        .then(() => undefined, (e: unknown) => e);
      expect(error).toBeInstanceOf(ProtocolError);
      expect((error as ProtocolError).code).toBe(INVALID_PARAMS);
      expect((error as ProtocolError).message).toContain("Invalid arguments");
      expect((error as ProtocolError).message).toContain("first");
    });
  });

  it("rejects missing required arguments with a -32602 protocol error", async () => {
    await withClient(async (client) => {
      const error = await client
        .callTool({ name: addToolId, arguments: { first: 1 } })
        .then(() => undefined, (e: unknown) => e);
      expect(error).toBeInstanceOf(ProtocolError);
      expect((error as ProtocolError).code).toBe(INVALID_PARAMS);
    });
  });

  it("reports a thrown tool error as isError: true with the message in content", async () => {
    await withClient(async (client) => {
      const result = await client.callTool({ name: multiplyToolId, arguments: { first: 2, second: 3 } });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
      const content = result.content as { type: string; text: string }[];
      expect(content[0]?.type).toBe("text");
      expect(content[0]?.text).toContain("Deliberate failure from multiply");
    });
  });

  it("still returns a normal result for a valid call", async () => {
    await withClient(async (client) => {
      const result = await client.callTool({ name: addToolId, arguments: { first: 2, second: 3 } });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({ value: 5 });
    });
  });
});
