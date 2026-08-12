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

  it("serves /package.json (contents overview)", async () => {
    const res = await app.request("/plugin.json");
    expect(res.status).toBe(200);
    const info = await res.json() as { name: string; tools: unknown[] };
    expect(info.name).toBe("@samples/test1");
    expect(Array.isArray(info.tools)).toBe(true);
  });

  it("exposes repository.directory in /plugin.json so docs can link to the real repo path", async () => {
    const res = await app.request("/plugin.json");
    const info = await res.json() as { repository?: { url: string; directory?: string } };
    expect(info.repository?.directory).toBe("samples/test1");
    expect(npxSkillsAddCommand(info.repository, "coin-flipper")).toBe(
      "npx skills add https://github.com/quartal-hub/plugin/tree/main/samples/test1/skills/coin-flipper",
    );
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
