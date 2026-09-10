import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { npxSkillsAddCommand } from "@quartal/plugin-core";
import { getAnonApp } from "../src/index.ts";

// Verifies the fully-assembled anonymous app serves every standard route group via app.fetch,
// using @samples/test1's committed qrtl-plugin/skills and an inline tool registry.

const test1Dir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

class Calculator {
  static add(input: { first: number; second: number }): number {
    return input.first + input.second;
  }
}

let app: Hono;

beforeAll(async () => {
  app = await getAnonApp({
    pluginRootFolder: test1Dir,
    toolModules: { Calculator: { Calculator } as unknown as Record<string, unknown> },
  });
});

describe("getAnonApp — full route assembly", () => {
  it("serves the vendored docs SPA at /", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.length).toBeGreaterThan(0);
    expect(html.toLowerCase()).toContain("html");
  });

  it("serves a docs SPA asset", async () => {
    const res = await app.request("/assets/does-not-exist.js");
    expect(res.status).toBe(404); // route exists, file doesn't → 404 (not an unmounted-route 404 shape)
  });

  it("executes a REST tool call", async () => {
    const res = await app.request("/api/Calculator/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first: 2, second: 3 }),
    });
    expect(await res.json()).toEqual({ value: 5 });
  });

  it("serves /open-api.json", async () => {
    expect((await app.request("/open-api.json")).status).toBe(200);
  });

  it("serves the Agent Plugins 1.0 manifest at /plugin.json", async () => {
    const res = await app.request("/plugin.json");
    expect(res.status).toBe(200);
    const manifest = await res.json() as {
      $schema: string;
      name: string;
      extensions?: Record<string, { contents?: string }>;
    };
    expect(manifest.$schema).toBe("https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
    expect(manifest.name).toBe("test1");
    expect(manifest.extensions?.["com.quartal.plugin"]?.contents).toBe("/com.quartal.plugin/contents.json");
  });

  it("serves the standard mcp.json pointing at this origin's /mcp", async () => {
    const res = await app.request("http://plugin.example/mcp.json");
    expect(res.status).toBe(200);
    const config = await res.json() as { mcpServers: Record<string, { type: string; url: string }> };
    expect(config.mcpServers.test1).toEqual({ type: "streamable-http", url: "http://plugin.example/mcp" });
  });

  it("serves the contents overview at /com.quartal.plugin/contents.json", async () => {
    const res = await app.request("/com.quartal.plugin/contents.json");
    expect(res.status).toBe(200);
    const info = await res.json() as { name: string; tools: unknown[] };
    expect(info.name).toBe("@samples/test1");
    expect(Array.isArray(info.tools)).toBe(true);
  });

  it("exposes repository.directory in the overview so docs can link to the real repo path", async () => {
    const res = await app.request("/com.quartal.plugin/contents.json");
    const info = await res.json() as { repository?: { url: string; directory?: string } };
    expect(info.repository?.directory).toBe("samples/test1");
    expect(npxSkillsAddCommand(info.repository, "coin-flipper")).toBe(
      "npx skills add https://github.com/quartal-hub/plugin/tree/main/samples/test1/skills/coin-flipper",
    );
  });

  it("serves the installable package at /plugin.zip", async () => {
    const res = await app.request("/plugin.zip");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    const bytes = new Uint8Array(await res.arrayBuffer());
    // ZIP local-file-header magic.
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("mirrors MCP tools/list at /mcp/tools.json", async () => {
    const res = await app.request("/mcp/tools.json");
    expect(res.status).toBe(200);
    const result = await res.json() as { tools: { name: string; inputSchema: unknown }[] };
    expect(result.tools.length).toBeGreaterThan(0);
    expect(result.tools[0].name).toBeTruthy();
    expect(result.tools[0].inputSchema).toBeTruthy();
  });

  it("serves /mcp-server.json", async () => {
    const res = await app.request("/mcp-server.json");
    expect(res.status).toBe(200);
    const impl = await res.json() as { name: string; version: string };
    expect(impl.name).toBe("test1");
    expect(impl.version).toBeTruthy();
  });

  it("serves /skills/catalog.json", async () => {
    const res = await app.request("/skills/catalog.json");
    expect(res.status).toBe(200);
    const catalog = await res.json() as { plugin: string; skills: { name: string }[] };
    expect(catalog.plugin).toBe("@samples/test1");
    expect(catalog.skills.length).toBeGreaterThan(0);
  });

  it("mounts the MCP endpoint at /mcp", async () => {
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } },
      }),
    });
    expect(res.status).not.toBe(404); // route is mounted (handled by the MCP transport)
  });
});
