import { describe, expect, it } from "vitest";

import {
  buildMcpTools,
  buildOpenApiDocument,
  buildPluginInfo,
  parseMcpTag,
  parseRestClassTag,
  parseRestTag,
  prepareCodeFilesForPlugin,
  resolveRestRoutes,
} from "../src/index.ts";
import type { PluginManifest } from "../src/index.ts";
import { analyzeSource } from "./helpers/analyzeSource.ts";

const manifest: PluginManifest = {
  name: "@test/pkg",
  title: "Test Pkg",
  description: "test",
  version: "1.0.0",
  style: { logo: "", icons: [{ src: "https://cdn.example/icon.png", sizes: ["128x128"] }] },
  imports: {},
};

const files = () => prepareCodeFilesForPlugin(analyzeSource({
  "/tools/Invoices.ts": `
    export class Invoices {
      /** Listed everywhere. */
      list(): string[] { return []; }
      /** Widget helper: REST only.
       * @mcp hidden
       */
      listRows(input: { page: number }): string[] { return []; }
      /** Agent only: no REST operation.
       * @rest hidden
       */
      draft(input: { customer: string }): string { return ""; }
    }
  `,
  "/tools/Internal.ts": `
    /** Helpers for the plugin's own widgets.
     * @rest hidden
     * @mcp hidden
     */
    export class Internal {
      ping(): string { return ""; }
    }
  `,
  "/tools/Legacy.ts": `
    /** Served over REST only.
     * @mcp hidden
     */
    export class Legacy {
      export(input: { id: string }): string { return ""; }
    }
  `,
}));

describe("@rest hidden / @mcp hidden", () => {
  it("parse on methods and classes, and reject anything else for @mcp", () => {
    expect(parseRestTag("hidden", "X.a")).toEqual({ hidden: true });
    expect(parseRestTag("HIDDEN", "X.a")).toEqual({ hidden: true });
    expect(parseRestClassTag("hidden", "X")).toEqual({ hidden: true });
    expect(parseMcpTag("hidden", "X.a")).toEqual({ hidden: true });
    expect(() => parseMcpTag("app", "X.a")).toThrow(/X\.a: @mcp "app" is not understood; the only setting is "@mcp hidden"/);
    expect(() =>
      analyzeSource({
        "/tools/X.ts": `
          export class X {
            /** Off.
             * @mcp off
             */
            a(): void {}
          }
        `,
      })).toThrow(/X\.a: @mcp "off"/);
  });

  it("land on the code model", () => {
    const invoices = files().find((f) => f.path === "tools/Invoices.ts")!.classes[0];
    const byName = Object.fromEntries(invoices.functions.map((fn) => [fn.name, fn]));
    expect(byName.listRows.mcp).toEqual({ hidden: true });
    expect(byName.listRows.rest).toBeUndefined();
    expect(byName.draft.rest).toEqual({ hidden: true });
    expect(byName.draft.mcp).toBeUndefined();
    const internal = files().find((f) => f.path === "tools/Internal.ts")!.classes[0];
    expect(internal.rest).toEqual({ hidden: true });
    expect(internal.mcp).toEqual({ hidden: true });
  });

  it("keep hidden methods out of the REST routes and the OpenAPI document", () => {
    const routes = resolveRestRoutes(files());
    expect([...routes.keys()]).toEqual(["Invoices.list", "Invoices.listRows", "Legacy.export"]);
    const doc = buildOpenApiDocument(files(), manifest) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths).sort()).toEqual(["/api/invoices", "/api/invoices/rows", "/api/legacy/export"]);
  });

  it("keep hidden methods out of the MCP tool list", () => {
    expect(buildMcpTools(files()).map((t) => `${t.className}.${t.methodName}`)).toEqual(["Invoices.list", "Invoices.draft"]);
  });

  it("show a hidden tool in the overview without the exposure it lacks", () => {
    const codeFiles = files();
    const info = buildPluginInfo({
      manifest,
      codeFiles,
      mcpTools: buildMcpTools(codeFiles),
      resources: [],
      prompts: [],
      widgetCatalog: [],
      skills: [],
      agents: [],
      basePath: "/api",
      hasReadme: false,
    });
    const byName = Object.fromEntries(info.tools.map((t) => [`${t.className}.${t.name}`, t.exposure]));
    expect(byName["Invoices.list"]).toEqual({ mcpName: "listInvoices", restUrl: "/api/invoices", restMethod: "GET" });
    expect(byName["Invoices.listRows"]).toEqual({ restUrl: "/api/invoices/rows", restMethod: "GET" });
    expect(byName["Invoices.draft"]).toEqual({ mcpName: "draft" });
    expect(byName["Internal.ping"]).toEqual({});
  });
});
