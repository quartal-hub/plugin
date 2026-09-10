import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import {
  agentPluginName,
  buildMcpServersConfig,
  getAnonApp,
  Helpers,
  resolveMcpServers,
} from "../src/index.ts";
import type { McpServerOptions, PluginManifest } from "../src/index.ts";

// Agent Plugins alignment: manifest naming, mcp.json building, multi-server resolution and the
// multi-server route mounting (sub-servers at /mcp/<name>, main at /mcp, prompts on main only).

const test1Dir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

class Calculator {
  static add(input: { first: number; second: number }): number {
    return input.first + input.second;
  }
}

let manifest: PluginManifest;

beforeAll(async () => {
  manifest = await Helpers.getPluginManifest(test1Dir);
});

describe("agentPluginName", () => {
  it("derives a spec-conforming name from a scoped npm name", () => {
    expect(agentPluginName("@samples/test1")).toBe("test1");
    expect(agentPluginName("@quartal/My_Plugin")).toBe("my-plugin");
    expect(agentPluginName("--weird..name--")).toBe("weird-name");
  });
});

describe("resolveMcpServers", () => {
  it("defaults to a single main server at /mcp", () => {
    const { local, external } = resolveMcpServers(manifest);
    expect(local).toEqual([{ name: "test1", path: "/mcp", main: true }]);
    expect(external).toEqual([]);
  });

  it("resolves named servers with main at /mcp and externals unmounted", () => {
    const options: McpServerOptions = {
      servers: {
        stats: { tools: ["HelloWorld"] },
        main: { tools: ["Calculator"] },
        crm: { external: { url: "https://crm.example.com/mcp", headers: { "x-api-key": "k" } } },
      },
    };
    const { local, external } = resolveMcpServers(manifest, options);
    expect(local[0]).toMatchObject({ name: "main", path: "/mcp", main: true, tools: ["Calculator"] });
    expect(local[1]).toMatchObject({ name: "stats", path: "/mcp/stats", main: false });
    expect(external).toEqual([
      { name: "crm", url: "https://crm.example.com/mcp", headers: { "x-api-key": "k" } },
    ]);
  });

  it("rejects invalid server names and external+tools combinations", () => {
    expect(() => resolveMcpServers(manifest, { servers: { "Bad Name": {} } })).toThrow(/Invalid MCP server name/);
    expect(() => resolveMcpServers(manifest, {
      servers: { x: { tools: ["A"], external: { url: "https://x.example.com/mcp" } } },
    })).toThrow(/cannot set both/);
  });
});

describe("buildMcpServersConfig", () => {
  it("builds the standard mcp.json with hosted and external servers", () => {
    const options: McpServerOptions = {
      servers: {
        main: { tools: ["Calculator"] },
        crm: { external: { url: "https://crm.example.com/mcp" } },
      },
    };
    const config = buildMcpServersConfig(manifest, options, "https://plugin.example");
    expect(config.$schema).toBe("https://agent-plugins.org/schemas/1.0.0/mcp.schema.json");
    expect(config.mcpServers.main).toEqual({ type: "streamable-http", url: "https://plugin.example/mcp" });
    expect(config.mcpServers.crm).toEqual({ type: "streamable-http", url: "https://crm.example.com/mcp" });
  });

  it("builds the Claude .mcp.json variant with type http and no $schema", () => {
    const config = buildMcpServersConfig(manifest, undefined, "https://plugin.example", "claude");
    expect(config.$schema).toBeUndefined();
    expect(config.mcpServers.test1).toEqual({ type: "http", url: "https://plugin.example/mcp" });
  });
});

describe("multi-server mounting", () => {
  let app: Hono;

  beforeAll(async () => {
    app = await getAnonApp({
      pluginRootFolder: test1Dir,
      toolModules: { Calculator: { Calculator } as unknown as Record<string, unknown> },
      mcp: {
        servers: {
          main: { tools: ["Calculator"] },
          stats: { tools: ["HelloWorld"] },
          crm: { external: { url: "https://crm.example.com/mcp" } },
        },
      },
    });
  });

  it("serves only the server's tool classes on each endpoint", async () => {
    const main = await (await app.request("/mcp/tools.json")).json() as { tools: { name: string }[] };
    const stats = await (await app.request("/mcp/stats/tools.json")).json() as { tools: { name: string }[] };
    expect(main.tools.length).toBeGreaterThan(0);
    expect(stats.tools.length).toBeGreaterThan(0);
    const mainNames = main.tools.map((t) => t.name);
    const statsNames = stats.tools.map((t) => t.name);
    expect(mainNames.some((n) => statsNames.includes(n))).toBe(false);
  });

  it("lists hosted and external servers in mcp.json", async () => {
    const config = await (await app.request("http://plugin.example/mcp.json")).json() as {
      mcpServers: Record<string, { url: string }>;
    };
    expect(config.mcpServers.main.url).toBe("http://plugin.example/mcp");
    expect(config.mcpServers.stats.url).toBe("http://plugin.example/mcp/stats");
    expect(config.mcpServers.crm.url).toBe("https://crm.example.com/mcp");
  });

  it("serves prompts on the main server only", async () => {
    const main = await (await app.request("/mcp/prompts.json")).json() as { prompts: unknown[] };
    const stats = await (await app.request("/mcp/stats/prompts.json")).json() as { prompts: unknown[] };
    expect(main.prompts.length).toBeGreaterThan(0);
    expect(stats.prompts.length).toBe(0);
  });
});
