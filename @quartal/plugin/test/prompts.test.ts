import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serve } from "@hono/node-server";
import type { Hono } from "hono";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { PluginApiHelper, PluginMcpHelper, type PluginAppConfig, type PromptResponse } from "../src/index.ts";

const test1Dir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

// The MCP prompt ids from the committed mcp-prompts.json.
const mcpPrompts = JSON.parse(readFileSync(join(test1Dir, "qrtl-plugin/mcp-prompts.json"), "utf-8")) as {
  prompts: { id: string; className: string; methodName: string; arguments: { name: string; required?: boolean }[] }[];
};
const writeGreetingId = mcpPrompts.prompts.find((p) => p.methodName === "writeGreeting")!.id;

/** Runtime twin of the analyzed fixture class (fixture sources are analyzed, not executed). */
class GreetingPrompts {
  static writeGreeting(input: { name: string; tone?: string }): string {
    const tone = input.tone ?? "friendly";
    return `Write a short, ${tone} greeting for ${input.name}. Keep it to two sentences.`;
  }

  static greetingVariants(input: { language: string }): PromptResponse {
    return {
      description: `Greetings in ${input.language}.`,
      messages: [
        { role: "user", content: { type: "text", text: `Greet me in ${input.language}.` } },
        { role: "assistant", content: { type: "text", text: "With pleasure!" } },
      ],
    };
  }
}

let server: { close: () => void } | undefined;
let baseUrl = "";

beforeAll(async () => {
  const config: PluginAppConfig = {
    pluginRootFolder: test1Dir,
    promptModules: { GreetingPrompts: { GreetingPrompts } as unknown as Record<string, unknown> },
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

describe("MCP prompts (Streamable HTTP end-to-end)", () => {
  it("lists prompts with arguments and renders one via prompts/get", async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    const client = new Client({ name: "hub-prompts-test", version: "0.0.1" }, { capabilities: {} });
    await client.connect(transport);
    try {
      const list = await client.listPrompts();
      const greeting = list.prompts.find((p) => p.name === writeGreetingId);
      expect(greeting, `prompts/list should include ${writeGreetingId}`).toBeDefined();
      const argNames = (greeting!.arguments ?? []).map((a) => a.name);
      expect(argNames).toEqual(expect.arrayContaining(["name", "tone"]));
      expect(greeting!.arguments!.find((a) => a.name === "name")?.required).toBe(true);
      expect(greeting!.arguments!.find((a) => a.name === "tone")?.required).toBeUndefined();

      // A string return becomes a single user text message.
      const result = await client.getPrompt({ name: writeGreetingId, arguments: { name: "Olli", tone: "playful" } });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      const content = result.messages[0].content as { type: string; text: string };
      expect(content.type).toBe("text");
      expect(content.text).toContain("playful greeting for Olli");

      // A PromptResponse return passes through with its own description + messages.
      const variantsId = mcpPrompts.prompts.find((p) => p.methodName === "greetingVariants")!.id;
      const variants = await client.getPrompt({ name: variantsId, arguments: { language: "Finnish" } });
      expect(variants.description).toBe("Greetings in Finnish.");
      expect(variants.messages).toHaveLength(2);
      expect(variants.messages[1].role).toBe("assistant");
    } finally {
      await transport.close();
    }
  });

  it("sends per-argument titles (property @summary) on the wire", async () => {
    // The SDK client's PromptArgumentSchema (<= 1.29) does not know `title` yet and strips it on
    // parse, so assert the raw JSON-RPC response instead of using Client.listPrompts().
    const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
    const init = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "raw", version: "0.0.1" } },
      }),
    });
    const sessionId = init.headers.get("mcp-session-id") ?? "";
    await init.text();
    const listRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { ...headers, "mcp-session-id": sessionId },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "prompts/list", params: {} }),
    });
    const sse = await listRes.text();
    const json = JSON.parse(sse.split("data: ")[1]) as {
      result: { prompts: { name: string; arguments?: { name: string; title?: string }[] }[] };
    };
    const greeting = json.result.prompts.find((p) => p.name === writeGreetingId);
    expect(greeting?.arguments?.find((a) => a.name === "name")?.title).toBe("Recipient name.");
  });

  it("returns an error for an unknown prompt", async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    const client = new Client({ name: "hub-prompts-test", version: "0.0.1" }, { capabilities: {} });
    await client.connect(transport);
    try {
      await expect(client.getPrompt({ name: "no-such-prompt" })).rejects.toThrow(/Unknown prompt/);
    } finally {
      await transport.close();
    }
  });
});
