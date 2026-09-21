import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { getAnonApp, Helpers, buildArtifactsModuleSource } from "../src/index.ts";
import type { PluginRuntimeArtifacts } from "../src/index.ts";

// Verifies the build-time artifacts snapshot fully replaces the disk reads: the app is assembled
// with a plugin root that does not exist, so every served value must come from the injected object.

const fixtureDir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

class Calculator {
  static add(input: { first: number; second: number }): number {
    return input.first + input.second;
  }
}

async function loadFixtureArtifacts(): Promise<PluginRuntimeArtifacts> {
  const json = async <T>(file: string): Promise<T> =>
    JSON.parse(await readFile(join(fixtureDir, "qrtl-plugin", file), "utf-8")) as T;
  return {
    tools: await json("tools.json"),
    openApi: await json("open-api.json"),
    types: await json("types.json"),
    contents: await json("contents.json"),
    mcpTools: await json("mcp-tools.json"),
    mcpPrompts: await json("mcp-prompts.json"),
    manifest: await Helpers.getPluginManifest(fixtureDir),
    readme: "# Injected readme",
    auth: "anon",
    widgetResources: [
      { toolId: "add", uri: "ui://widgets/add.html", name: "Injected widget", pagePath: "/widgets/add" },
    ],
  };
}

let app: Hono;
let server: { close: () => void } | undefined;
let baseUrl = "";

beforeAll(async () => {
  app = await getAnonApp({
    // Nonexistent on purpose: resolvePluginRoot falls back to cwd, which holds none of the plugin's
    // files either — everything served must come from `artifacts`.
    pluginRootFolder: join(tmpdir(), "qrtl-artifacts-injection-does-not-exist"),
    artifacts: await loadFixtureArtifacts(),
    toolModules: { Calculator: { Calculator } as unknown as Record<string, unknown> },
  });
  await new Promise<void>((resolve) => {
    server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, (info: { port: number }) => {
      baseUrl = `http://127.0.0.1:${info.port}`;
      resolve();
    }) as unknown as { close: () => void };
  });
});
afterAll(() => server?.close());

describe("getAnonApp with injected artifacts (no disk reads)", () => {
  it("serves the manifest-derived plugin.json", async () => {
    const res = await app.request("/plugin.json");
    expect(res.status).toBe(200);
    const manifest = await res.json() as { name: string };
    expect(manifest.name).toBe("test1");
  });

  it("serves the injected contents overview", async () => {
    const res = await app.request("/com.quartal.plugin/contents.json");
    expect(res.status).toBe(200);
    const info = await res.json() as { name: string; tools: unknown[] };
    expect(info.name).toBe("@samples/test1");
    expect(info.tools.length).toBeGreaterThan(0);
  });

  it("serves the injected OpenAPI document", async () => {
    const res = await app.request("/open-api.json");
    expect(res.status).toBe(200);
    const doc = await res.json() as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths).length).toBeGreaterThan(0);
  });

  it("executes a REST tool call against the injected tool metadata", async () => {
    const res = await app.request("/api/Calculator/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first: 2, second: 3 }),
    });
    expect(await res.json()).toEqual({ value: 5 });
  });

  it("lists MCP tools from the injected descriptors", async () => {
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('"tools"');
    expect(body).toContain("add");
  });

  it("uses the injected widget entries without discovery", async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    const client = new Client({ name: "artifacts-test", version: "0.0.1" }, { capabilities: {} });
    await client.connect(transport);
    try {
      const list = await client.listResources();
      const widget = list.resources.find((r) => r.uri === "ui://widgets/add.html");
      expect(widget, "resources/list should include the injected widget").toBeDefined();
      expect(widget!.name).toBe("Injected widget");
    } finally {
      await client.close();
    }
  });
});

describe("buildArtifactsModuleSource", () => {
  it("imports the JSON artifacts and inlines the resolved values", () => {
    const src = buildArtifactsModuleSource({
      manifest: { name: "x", title: "X", description: "d", version: "1.0.0", style: { logo: "l", icons: [] } },
      readme: "# Hello",
      auth: "quartal-hub",
      mcp: { name: "X Server" },
      widgetResources: [],
    });
    expect(src).toContain(`import tools from "./tools.json";`);
    expect(src).toContain(`import contents from "./contents.json";`);
    expect(src).toContain(`auth: "quartal-hub"`);
    expect(src).toContain(`"# Hello"`);
    expect(src).toContain("X Server");
    expect(src).toContain("@ts-nocheck");
  });

  it("omits readme and mcp when absent", () => {
    const src = buildArtifactsModuleSource({
      manifest: { name: "x", title: "X", description: "d", version: "1.0.0", style: { logo: "l", icons: [] } },
      auth: "anon",
      widgetResources: [],
    });
    expect(src).not.toContain("readme:");
    expect(src).not.toContain("mcp:");
    expect(src).toContain(`auth: "anon"`);
  });
});
