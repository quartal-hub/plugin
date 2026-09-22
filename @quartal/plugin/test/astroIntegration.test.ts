import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import {
  buildPluginMiddlewareSource,
  CATCH_ALL_ROUTE,
  createPluginMiddleware,
  getAnonApp,
  PLUGIN_MIDDLEWARE_VIRTUAL_ID,
  isServerPath,
  isServerPathWithOwnIndexPage,
  qrtlPlugin,
} from "../src/index.ts";
import type { AstroConfigSetupOptions } from "../src/astro/integration.ts";

const test1Dir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

class Calculator {
  static add(input: { first: number; second: number }): number {
    return input.first + input.second;
  }
}

describe("isServerPath", () => {
  it("matches Hono server routes", () => {
    const paths = [
      "/", "/api/Calculator/add", "/mcp", "/mcp/x", "/skills/catalog.json", "/agents/catalog.json",
      "/agents/greeter.md", "/icons/0", "/plugin.json", "/widget-assets/_astro/x.js",
      "/.well-known/oauth-protected-resource",
    ];
    for (const p of paths) {
      expect(isServerPath(p), p).toBe(true);
    }
  });
  it("lets Astro handle widget pages, static assets and user pages", () => {
    for (const p of ["/widgets/simpleSalary", "/_astro/index.abc.js", "/assets/x.js", "/some-user-page", "/mcpanything"]) {
      expect(isServerPath(p), p).toBe(false);
    }
  });
});

describe("isServerPathWithOwnIndexPage", () => {
  it("releases the docs shell paths to Astro but keeps the machine routes", () => {
    for (const p of ["/", "/mcp.html", "/swagger.html", "/docs.html", "/skills.html", "/agents.html"]) {
      expect(isServerPathWithOwnIndexPage(p), p).toBe(false);
    }
    for (const p of ["/plugin.json", "/mcp", "/api/Calculator/add", "/oauth/login", "/open-api.json"]) {
      expect(isServerPathWithOwnIndexPage(p), p).toBe(true);
    }
  });
});

describe("createPluginMiddleware", () => {
  let app: Hono;
  beforeAll(async () => {
    app = await getAnonApp({
      pluginRootFolder: test1Dir,
      toolModules: { Calculator: { Calculator } as unknown as Record<string, unknown> },
    });
  });

  const nextResponse = () => Promise.resolve(new Response("ASTRO", { status: 299 }));

  it("delegates server routes to the Hono app", async () => {
    const mw = createPluginMiddleware(app);
    const res = await mw(
      { request: new Request("http://x/api/Calculator/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ first: 2, second: 3 }) }) },
      nextResponse,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ value: 5 });
  });

  it("falls through to Astro for non-server paths", async () => {
    const mw = createPluginMiddleware(app);
    const res = await mw({ request: new Request("http://x/widgets/whatever") }, nextResponse);
    expect(res.status).toBe(299);
    expect(await res.text()).toBe("ASTRO");
  });

  it("with ownIndexPage, Astro renders / while machine routes stay delegated", async () => {
    const mw = createPluginMiddleware(app, { ownIndexPage: true });
    const index = await mw({ request: new Request("http://x/") }, nextResponse);
    expect(index.status).toBe(299);
    const machine = await mw({ request: new Request("http://x/plugin.json") }, nextResponse);
    expect(machine.status).toBe(200);
  });
});

describe("qrtlPlugin integration", () => {
  const tempDirs: string[] = [];
  async function tempPlugin(files: Record<string, string>): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "qrtl-integ-"));
    tempDirs.push(dir);
    for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content);
    return dir;
  }
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  async function runSetup(output: string, options?: Parameters<typeof qrtlPlugin>[0], root = "/proj") {
    const integ = qrtlPlugin(options);
    let vitePlugins: { name: string }[] = [];
    let updatedConfig: Record<string, unknown> = {};
    let middleware: { entrypoint: string | URL; order: string } | undefined;
    const routes: { pattern: string; entrypoint: string | URL; prerender?: boolean }[] = [];
    const warnings: string[] = [];
    const watched: (string | URL)[] = [];
    const opts: AstroConfigSetupOptions = {
      config: { output, root },
      updateConfig: (c) => {
        updatedConfig = c;
        vitePlugins = ((c as { vite?: { plugins?: { name: string }[] } }).vite?.plugins) ?? [];
      },
      addMiddleware: (m) => {
        middleware = m;
      },
      injectRoute: (r) => {
        routes.push(r);
      },
      addWatchFile: (p) => {
        watched.push(p);
      },
      logger: { warn: (m) => warnings.push(m), info: () => {} },
      command: "dev",
    };
    await integ.hooks["astro:config:setup"]!(opts);
    return { integ, vitePlugins, updatedConfig, middleware, routes, warnings, watched };
  }

  /** The generated virtual middleware source from a setup's vite plugins. */
  function middlewareSource(vitePlugins: { name: string }[]): string {
    const plugin = vitePlugins.find((p) => p.name === "qrtl-plugin-middleware") as unknown as {
      resolveId(id: string): string | undefined;
      load(id: string): string | undefined;
    };
    return plugin.load(plugin.resolveId(PLUGIN_MIDDLEWARE_VIRTUAL_ID)!)!;
  }

  it("has the expected name and hook", () => {
    const integ = qrtlPlugin();
    expect(integ.name).toBe("@quartal/plugin");
    expect(typeof integ.hooks["astro:config:setup"]).toBe("function");
  });

  it("adds the codegen + virtual-middleware vite plugins and mounts middleware", async () => {
    const { vitePlugins, middleware } = await runSetup("server");
    const names = vitePlugins.map((p) => p.name);
    expect(names).toContain("qrtl-plugin-codegen");
    expect(names).toContain("qrtl-plugin-middleware");
    expect(middleware?.entrypoint).toBe(PLUGIN_MIDDLEWARE_VIRTUAL_ID);
    expect(middleware?.order).toBe("pre");
  });

  it("injects a server-rendered catch-all route so the Hono paths are in Astro's route table", async () => {
    const { routes } = await runSetup("server");
    expect(routes).toEqual([CATCH_ALL_ROUTE]);
    expect(CATCH_ALL_ROUTE.pattern).toBe("/[...qrtlPath]");
    // A project file (written by the codegen), not a node_modules path: Vite would externalize that.
    expect(CATCH_ALL_ROUTE.entrypoint).toBe("./src/qrtl-plugin/catchAllRoute.ts");
    expect(CATCH_ALL_ROUTE.prerender).toBe(false);
  });

  it("writes the catch-all route module into the project before Astro builds its route manifest", async () => {
    const root = await tempPlugin({});
    await runSetup("server", undefined, root);
    const source = await readFile(join(root, "src", "qrtl-plugin", "catchAllRoute.ts"), "utf8");
    expect(source).toContain('export { ALL } from "@quartal/plugin/astro/route";');
    // A root that does not exist on disk gets no file (and no error).
    await expect(runSetup("server", undefined, join(root, "missing"))).resolves.toBeDefined();
  });

  it("warns when output is not on-demand-capable", async () => {
    expect((await runSetup("static")).warnings.length).toBeGreaterThan(0);
    expect((await runSetup("server")).warnings.length).toBe(0);
  });

  it("hides the Astro dev toolbar by default, keeps it with devToolbar: true", async () => {
    expect((await runSetup("server")).updatedConfig.devToolbar).toEqual({ enabled: false });
    expect((await runSetup("server", { devToolbar: true })).updatedConfig.devToolbar).toBeUndefined();
  });

  it("virtual-middleware plugin resolves/loads generated server source", async () => {
    const { vitePlugins } = await runSetup("server");
    const src = middlewareSource(vitePlugins);
    expect(src).toContain("tools.registry.ts");
    expect(src).toContain("prompts.registry.ts");
    expect(src).toContain("promptModules");
    expect(src).toContain("getAnonApp");
    expect(src).toContain("createPluginMiddleware");
  });

  it("detects src/pages/index.* and generates an ownIndexPage middleware", async () => {
    const withIndex = await tempPlugin({});
    await mkdir(join(withIndex, "src", "pages"), { recursive: true });
    await writeFile(join(withIndex, "src", "pages", "index.astro"), "<h1>My landing page</h1>");
    expect(middlewareSource((await runSetup("server", undefined, withIndex)).vitePlugins))
      .toContain("{ ownIndexPage: true }");

    const withoutIndex = await tempPlugin({});
    expect(middlewareSource((await runSetup("server", undefined, withoutIndex)).vitePlugins))
      .not.toContain("ownIndexPage");
  });

  it("reads the auth mode from qrtl.config and watches the config file", async () => {
    const root = await tempPlugin({ "qrtl.config.mjs": 'export default { auth: "quartal-hub" };' });
    const { vitePlugins, watched, warnings } = await runSetup("server", undefined, root);
    expect(middlewareSource(vitePlugins)).toContain("getAuthApp");
    expect(watched).toContain(join(root, "qrtl.config.mjs"));
    expect(warnings.length).toBe(0);
  });

  it("fails the build when qrtl.config exists but cannot be loaded", async () => {
    const root = await tempPlugin({ "qrtl.config.mjs": "export default {" });
    await expect(runSetup("server", undefined, root)).rejects.toThrow(/qrtl\.config\.mjs/);
  });

  it("deprecated qrtlPlugin({ auth }) still wins over qrtl.config and warns", async () => {
    const root = await tempPlugin({ "qrtl.config.mjs": 'export default { auth: "anon" };' });
    const { vitePlugins, warnings } = await runSetup("server", { auth: "quartal-hub" }, root);
    expect(middlewareSource(vitePlugins)).toContain("getAuthApp");
    expect(warnings.some((w) => w.includes("deprecated"))).toBe(true);
  });
});

describe("buildPluginMiddlewareSource", () => {
  it("uses getAnonApp for anon and getAuthApp for quartal-hub and custom", () => {
    const anon = buildPluginMiddlewareSource({ auth: "anon", registryImport: "/src/qrtl-plugin/tools.registry.ts" });
    expect(anon).toContain("getAnonApp");
    expect(anon).not.toContain("getAuthApp");

    const hub = buildPluginMiddlewareSource({ auth: "quartal-hub", root: "/proj", registryImport: "/src/qrtl-plugin/tools.registry.ts" });
    expect(hub).toContain("getAuthApp");
    expect(hub).toContain('pluginRootFolder: "/proj"');

    const custom = buildPluginMiddlewareSource({ auth: "custom", registryImport: "/src/qrtl-plugin/tools.registry.ts" });
    expect(custom).toContain("getAuthApp");
  });

  it("imports and passes promptModules when a prompts registry is given", () => {
    const src = buildPluginMiddlewareSource({
      auth: "anon",
      registryImport: "/src/qrtl-plugin/tools.registry.ts",
      promptsRegistryImport: "/src/qrtl-plugin/prompts.registry.ts",
    });
    expect(src).toContain('import { promptModules } from "/src/qrtl-plugin/prompts.registry.ts";');
    expect(src).toContain("toolModules, promptModules");

    const withoutPrompts = buildPluginMiddlewareSource({ auth: "anon", registryImport: "/src/qrtl-plugin/tools.registry.ts" });
    expect(withoutPrompts).not.toContain("promptModules");
  });

  it("imports and passes artifacts when an artifacts module is given", () => {
    const src = buildPluginMiddlewareSource({
      auth: "anon",
      registryImport: "/src/qrtl-plugin/tools.registry.ts",
      artifactsImport: "/src/qrtl-plugin/artifacts.ts",
    });
    expect(src).toContain('import { artifacts } from "/src/qrtl-plugin/artifacts.ts";');
    expect(src).toContain(", artifacts");

    const without = buildPluginMiddlewareSource({ auth: "anon", registryImport: "/src/qrtl-plugin/tools.registry.ts" });
    expect(without).not.toContain("artifacts");
  });
});
