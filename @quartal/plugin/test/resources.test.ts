import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { buildMcpResources } from "../src/code/buildMcpResources.ts";
import { buildMcpTools } from "../src/code/buildMcpTools.ts";
import { Helpers } from "../src/helpers/Helpers.ts";
import { getAnonApp } from "../src/index.ts";
import type { McpResourceDescriptor, QuartalPluginContext } from "../src/index.ts";
import { analyzeSource } from "./helpers/analyzeSource.ts";

// The plugin's own MCP resources: methods of `src/resources/` classes with a `@uri` tag become
// resources (fixed URI) or resource templates (URI with `{variables}`), read over MCP.

const fixtureDir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

const POLICIES_SOURCE = `
export type ExpenseCategory = "travel" | "meals";

/** The company's policies. */
export class Policies {
  /**
   * The travel policy.
   * @summary Travel policy
   * @uri policy://travel
   * @mimeType text/markdown
   * @cache 5m public
   */
  travel(): string {
    return "# Travel";
  }

  /**
   * The rules of one expense category.
   * @uri policy://expenses/{category}
   */
  expense(input: { category: ExpenseCategory }): string {
    return "rules";
  }

  /**
   * The company logo.
   * @uri policy://logo.png
   * @mimeType image/png
   */
  logo(): Uint8Array {
    return new Uint8Array();
  }
}
`;

const TOOLS_SOURCE = `
/** Calculator. */
export class Calculator {
  /** Adds. @param input Numbers. */
  static add(input: { first: number; second: number }): number { return input.first + input.second; }
}
`;

describe("buildMcpResources — @uri methods of src/resources/", () => {
  let resources: McpResourceDescriptor[];

  beforeAll(() => {
    resources = buildMcpResources(analyzeSource({ "/tools/Policies.ts": POLICIES_SOURCE }));
  });

  it("describes fixed resources and templates from the JSDoc tags", () => {
    expect(resources.find((r) => r.methodName === "travel")).toEqual({
      id: "travel",
      fileName: "Policies",
      className: "Policies",
      methodName: "travel",
      uri: "policy://travel",
      template: false,
      title: "Travel policy",
      description: "The travel policy.",
      mimeType: "text/markdown",
      cacheTtlMs: 300_000,
      cacheScope: "public",
    });
    expect(resources.find((r) => r.methodName === "expense")).toMatchObject({
      uri: "policy://expenses/{category}",
      template: true,
    });
  });

  it("fails the build for a method without @uri or a template variable the input lacks", () => {
    expect(() => buildMcpResources(analyzeSource({
      "/tools/Bad.ts": "export class Bad { /** No uri. */ read(): string { return \"\"; } }",
    }))).toThrow(/Bad\.read: a resource method needs a @uri tag/);
    expect(() => buildMcpResources(analyzeSource({
      "/tools/Bad.ts": `export class Bad {
  /**
   * Reads.
   * @uri x://{id}
   */
  read(input: { other: string }): string { return ""; }
}`,
    }))).toThrow(/\{id\} are not properties/);
  });
});

describe("plugin resources over MCP", () => {
  let server: { close: () => void } | undefined;
  let baseUrl = "";
  let app: Hono;

  beforeAll(async () => {
    const toolFiles = analyzeSource({ "/tools/Calculator.ts": TOOLS_SOURCE });
    const resources = buildMcpResources(analyzeSource({ "/tools/Policies.ts": POLICIES_SOURCE }));
    const seen: { category?: unknown; authenticated?: boolean }[] = [];
    class Policies {
      travel() {
        return "# Travel";
      }
      expense(input: { category: string }, ctx: QuartalPluginContext) {
        seen.push({ category: input.category, authenticated: ctx.authenticated });
        return `Rules for ${input.category}`;
      }
      logo() {
        return new Uint8Array([137, 80, 78, 71]);
      }
    }
    class Calculator {
      static add(input: { first: number; second: number }) {
        return input.first + input.second;
      }
    }
    app = await getAnonApp({
      pluginRootFolder: fixtureDir,
      artifacts: {
        tools: { files: toolFiles },
        mcpTools: { tools: buildMcpTools(toolFiles) },
        mcpResources: { resources },
        manifest: await Helpers.getPluginManifest(fixtureDir),
        auth: "anon",
        widgetResources: [],
      },
      toolModules: { Calculator: { Calculator } as unknown as Record<string, unknown> },
      resourceModules: { Policies: { Policies } as unknown as Record<string, unknown> },
    });
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
    const client = new Client(
      { name: "resources-test", version: "0.0.1" },
      { capabilities: {}, versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    await client.connect(transport);
    try {
      return await fn(client);
    } finally {
      await transport.close();
    }
  }

  it("lists fixed resources and templates", async () => {
    await withClient(async (client) => {
      const list = await client.listResources();
      const own = list.resources.map((r) => r.uri).filter((uri) => uri.startsWith("policy://")).sort();
      expect(own).toEqual(["policy://logo.png", "policy://travel"]);
      const templates = await client.listResourceTemplates();
      expect(templates.resourceTemplates.map((t) => t.uriTemplate)).toContain("policy://expenses/{category}");
    });
    const mirror = await (await app.request("/mcp/resources.json")).json() as { resources: { uri: string }[] };
    expect(mirror.resources.map((r) => r.uri)).toContain("policy://travel");
  });

  it("reads text, template and binary resources", async () => {
    await withClient(async (client) => {
      const travel = await client.readResource({ uri: "policy://travel" });
      expect(travel.contents[0]).toMatchObject({ uri: "policy://travel", mimeType: "text/markdown", text: "# Travel" });

      const meals = await client.readResource({ uri: "policy://expenses/meals" });
      expect(meals.contents[0]).toMatchObject({ text: "Rules for meals", mimeType: "text/plain" });

      const logo = await client.readResource({ uri: "policy://logo.png" });
      expect(logo.contents[0]).toMatchObject({ mimeType: "image/png", blob: Buffer.from([137, 80, 78, 71]).toString("base64") });
    });
  });
});
