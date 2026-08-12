import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  buildPluginMiddlewareSource,
  discoverWidgets,
  discoverWidgetsSync,
  getAnonApp,
  registerWidgetAssetRoutes,
  resolveWidgetEntries,
  rewriteWidgetHtml,
  toWidgetCatalog,
  WIDGET_ASSETS_PREFIX,
  type WidgetEntry,
  withWidgetOrigin,
} from "../src/index.ts";

const test1Dir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

class Calculator {
  static add(input: { first: number; second: number }): number {
    return input.first + input.second;
  }
}

describe("discoverWidgets", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "qrtl-widgets-"));
    await writeFile(join(dir, "simpleSalary.astro"), "<html></html>");
    await writeFile(join(dir, "getEmployees.vue"), "<template/>");
    await writeFile(join(dir, "_Layout.astro"), "ignored"); // underscore-prefixed → skipped
    await writeFile(join(dir, "notes.md"), "not a page"); // unknown ext → skipped
  });
  afterAll(async () => rm(dir, { recursive: true, force: true }));

  it("finds widget pages by tool id (filename), sorted, skipping partials/non-pages", async () => {
    const widgets = await discoverWidgets(dir);
    expect(widgets.map((w) => w.toolId)).toEqual(["getEmployees", "simpleSalary"]);
    expect(widgets.every((w) => w.name === w.toolId)).toBe(true);
  });

  it("sync variant matches async", () => {
    expect(discoverWidgetsSync(dir).map((w) => w.toolId)).toEqual(["getEmployees", "simpleSalary"]);
  });

  it("returns [] for a missing directory", async () => {
    expect(await discoverWidgets(join(dir, "nope"))).toEqual([]);
  });

  it("applies shared + per-widget CSP and name overrides", async () => {
    const widgets = await discoverWidgets(dir, {
      csp: { connectDomains: ["https://cdn.example.com"] },
      entries: { simpleSalary: { name: "Simple Salary", csp: { resourceDomains: ["https://esm.sh"] } } },
    });
    const simple = widgets.find((w) => w.toolId === "simpleSalary")!;
    expect(simple.name).toBe("Simple Salary");
    expect(simple.csp).toEqual({ connectDomains: ["https://cdn.example.com"], resourceDomains: ["https://esm.sh"] });
    // widget without an override inherits only the shared CSP
    expect(widgets.find((w) => w.toolId === "getEmployees")!.csp).toEqual({ connectDomains: ["https://cdn.example.com"] });
  });

  it("projects to the catalog shape", async () => {
    expect(toWidgetCatalog(await discoverWidgets(dir))).toEqual([
      { toolId: "getEmployees", name: "getEmployees" },
      { toolId: "simpleSalary", name: "simpleSalary" },
    ]);
  });
});

describe("rewriteWidgetHtml", () => {
  const origin = "https://pkg.example.com";

  it("rewrites root-relative asset refs (scripts, styles, islands) to the widget-assets origin", () => {
    const html = [
      '<link rel="stylesheet" href="/_astro/widget.abc.css">',
      '<link rel="modulepreload" href="/_astro/vendor.def.js">',
      '<script type="module" src="/_astro/page.ghi.js"></script>',
      '<astro-island component-url="/_astro/comp.js" renderer-url="/_astro/rend.js" client="only"></astro-island>',
      "<img src='/logo.png'>",
    ].join("\n");
    const out = rewriteWidgetHtml(html, origin);
    expect(out).toContain(`href="${origin}${WIDGET_ASSETS_PREFIX}/_astro/widget.abc.css"`);
    expect(out).toContain(`href="${origin}${WIDGET_ASSETS_PREFIX}/_astro/vendor.def.js"`);
    expect(out).toContain(`src="${origin}${WIDGET_ASSETS_PREFIX}/_astro/page.ghi.js"`);
    expect(out).toContain(`component-url="${origin}${WIDGET_ASSETS_PREFIX}/_astro/comp.js"`);
    expect(out).toContain(`renderer-url="${origin}${WIDGET_ASSETS_PREFIX}/_astro/rend.js"`);
    expect(out).toContain(`src='${origin}${WIDGET_ASSETS_PREFIX}/logo.png'`);
    expect(out).not.toContain('"/_astro/');
  });

  it("leaves external, protocol-relative and data: references untouched", () => {
    const html = [
      '<script src="https://esm.sh/@salaxy/core"></script>',
      '<link rel="stylesheet" href="//cdn.example.com/skin.css">',
      '<img src="data:image/png;base64,AAAA">',
    ].join("\n");
    expect(rewriteWidgetHtml(html, origin)).toBe(html);
  });

  it("is idempotent for already-prefixed refs", () => {
    const html = `<script src="${WIDGET_ASSETS_PREFIX}/_astro/a.js"></script>`;
    expect(rewriteWidgetHtml(html, origin)).toBe(
      `<script src="${origin}${WIDGET_ASSETS_PREFIX}/_astro/a.js"></script>`,
    );
  });
});

describe("withWidgetOrigin", () => {
  const origin = "https://pkg.example.com";

  it("whitelists the origin in resourceDomains + connectDomains, preserving configured domains", () => {
    const csp = withWidgetOrigin(
      { resourceDomains: ["https://esm.sh"], connectDomains: ["https://esm.sh"], frameDomains: ["https://f"] },
      origin,
    );
    expect(csp.resourceDomains).toEqual(["https://esm.sh", origin]);
    expect(csp.connectDomains).toEqual(["https://esm.sh", origin]);
    expect(csp.frameDomains).toEqual(["https://f"]);
  });

  it("creates a CSP when none is configured and does not duplicate the origin", () => {
    expect(withWidgetOrigin(undefined, origin)).toEqual({ resourceDomains: [origin], connectDomains: [origin] });
    const already = withWidgetOrigin({ resourceDomains: [origin], connectDomains: [origin] }, origin);
    expect(already.resourceDomains).toEqual([origin]);
    expect(already.connectDomains).toEqual([origin]);
  });
});

describe("resolveWidgetEntries (runtime discovery + qrtl.config merge)", () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "qrtl-resolve-"));
    await mkdir(join(root, "src", "pages", "widgets"), { recursive: true });
    await writeFile(join(root, "src", "pages", "widgets", "simpleSalary.astro"), "<html/>");
    await writeFile(join(root, "src", "pages", "widgets", "getCompanies.astro"), "<html/>");
    await writeFile(
      join(root, "qrtl.config.json"),
      JSON.stringify({
        widgets: {
          csp: { connectDomains: ["https://esm.sh"] },
          entries: { simpleSalary: { name: "Simple Salary" } },
        },
      }),
    );
  });
  afterAll(async () => rm(root, { recursive: true, force: true }));

  it("discovers pages and applies the qrtl.config widgets section (names + CSP)", async () => {
    const entries = await resolveWidgetEntries({ pluginRootFolder: root });
    expect(entries.map((e) => e.toolId)).toEqual(["getCompanies", "simpleSalary"]);
    const simple = entries.find((e) => e.toolId === "simpleSalary")!;
    expect(simple.uri).toBe("ui://widgets/simpleSalary.html");
    expect(simple.name).toBe("Simple Salary");
    expect(simple.pagePath).toBe("/widgets/simpleSalary");
    expect(simple.csp).toEqual({ connectDomains: ["https://esm.sh"] });
  });

  it("returns [] when the pages directory is missing", async () => {
    expect(await resolveWidgetEntries({ pluginRootFolder: join(root, "nope") })).toEqual([]);
  });
});

describe("widget-assets passthrough (CORS for cross-origin module loads)", () => {
  let server: { close: () => void };
  let baseUrl = "";

  beforeAll(async () => {
    const app = new Hono();
    // Stand-in for the adapter's static /_astro serving (no CORS headers of its own).
    app.get("/_astro/chunk.js", (c) => c.text("export const v = 1;", 200, { "content-type": "text/javascript" }));
    registerWidgetAssetRoutes(app);
    await new Promise<void>((resolve) => {
      server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, (info: { port: number }) => {
        baseUrl = `http://127.0.0.1:${info.port}`;
        resolve();
      }) as unknown as { close: () => void };
    });
  });
  afterAll(() => server?.close());

  it("mirrors the same-origin response with ACAO + immutable caching for /_astro chunks", async () => {
    const res = await fetch(`${baseUrl}${WIDGET_ASSETS_PREFIX}/_astro/chunk.js`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("export const v = 1;");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("content-type")).toContain("text/javascript");
  });

  it("propagates upstream 404s", async () => {
    const res = await fetch(`${baseUrl}${WIDGET_ASSETS_PREFIX}/_astro/missing.js`);
    expect(res.status).toBe(404);
  });

  it("refuses protocol-relative escapes and self-recursion", async () => {
    const escape = await fetch(`${baseUrl}${WIDGET_ASSETS_PREFIX}//evil.example.com/x.js`);
    expect(escape.status).toBe(404);
    const recursive = await fetch(`${baseUrl}${WIDGET_ASSETS_PREFIX}${WIDGET_ASSETS_PREFIX}/_astro/chunk.js`);
    expect(recursive.status).toBe(404);
  });
});

describe("buildPluginMiddlewareSource", () => {
  it("carries no widget config — widget names/CSP come from qrtl.config at runtime", () => {
    const src = buildPluginMiddlewareSource({ auth: "anon", registryImport: "/src/qrtl-plugin/tools.registry.ts" });
    expect(src).toContain("getAnonApp");
    expect(src).not.toContain("widget");
  });
});

describe("widget MCP resources served live (runtime)", () => {
  let server: { close: () => void };
  let baseUrl = "";
  const fetchedWith: { toolId?: string; origin?: string } = {};
  const widget: WidgetEntry = {
    toolId: "add",
    uri: "ui://widgets/add.html",
    name: "Adder",
    pagePath: "/widgets/add",
    csp: { connectDomains: ["https://esm.sh"] },
  };
  const pageHtml = [
    "<!DOCTYPE html><html><head>",
    '<link rel="stylesheet" href="/_astro/add.css">',
    "</head><body>",
    '<astro-island component-url="/_astro/comp.js" renderer-url="/_astro/rend.js"></astro-island>',
    '<script type="module" src="/_astro/page.js"></script>',
    "</body></html>",
  ].join("\n");

  beforeAll(async () => {
    const app = await getAnonApp({
      pluginRootFolder: test1Dir,
      toolModules: { Calculator: { Calculator } as unknown as Record<string, unknown> },
      widgetResources: [widget],
      fetchWidgetHtml: async (entry, origin) => {
        fetchedWith.toolId = entry.toolId;
        fetchedWith.origin = origin;
        return pageHtml;
      },
    });
    await new Promise<void>((resolve) => {
      server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, (info: { port: number }) => {
        baseUrl = `http://127.0.0.1:${info.port}`;
        resolve();
      }) as unknown as { close: () => void };
    });
  });
  afterAll(() => server?.close());

  it("advertises the widget and serves the live page rewritten to the serving origin", async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    const client = new Client({ name: "hub-widget-test", version: "0.0.1" }, { capabilities: {} });
    await client.connect(transport);
    try {
      const list = await client.listResources();
      const res = list.resources.find((r) => r.uri === widget.uri);
      expect(res, "resources/list should include the widget").toBeDefined();
      expect(res!.name).toBe("Adder");
      expect(res!.mimeType).toBe("text/html;profile=mcp-app");
      // The serving origin is whitelisted alongside the configured CSP domains.
      const listCsp = (res!._meta as { ui: { csp: { connectDomains: string[]; resourceDomains: string[] } } }).ui.csp;
      expect(listCsp.connectDomains).toEqual(["https://esm.sh", baseUrl]);
      expect(listCsp.resourceDomains).toEqual([baseUrl]);

      const read = await client.readResource({ uri: widget.uri });
      const content = read.contents[0] as { uri: string; mimeType?: string; text?: string; _meta?: Record<string, unknown> };
      expect(fetchedWith).toEqual({ toolId: "add", origin: baseUrl });
      // Live page HTML with every local ref rewritten to an absolute widget-assets URL.
      expect(content.text).toContain(`href="${baseUrl}${WIDGET_ASSETS_PREFIX}/_astro/add.css"`);
      expect(content.text).toContain(`component-url="${baseUrl}${WIDGET_ASSETS_PREFIX}/_astro/comp.js"`);
      expect(content.text).toContain(`src="${baseUrl}${WIDGET_ASSETS_PREFIX}/_astro/page.js"`);
      expect(content.text).not.toContain('"/_astro/');
      const readCsp = (content._meta as { ui: { csp: { connectDomains: string[] } } }).ui.csp;
      expect(readCsp.connectDomains).toEqual(["https://esm.sh", baseUrl]);

      // tools/list still points the tool at its UI resource.
      const tools = await client.listTools();
      const add = tools.tools.find((t) => t.name === "add");
      expect((add?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui?.resourceUri).toBe(widget.uri);
    } finally {
      await transport.close();
    }
  });
});
