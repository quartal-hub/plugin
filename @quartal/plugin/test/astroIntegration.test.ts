import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import {
  buildPluginMiddlewareSource,
  createPluginMiddleware,
  getAnonApp,
  PLUGIN_MIDDLEWARE_VIRTUAL_ID,
  isServerPath,
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
    for (const p of ["/", "/api/Calculator/add", "/mcp", "/mcp/x", "/skills/catalog.json", "/icons/0", "/plugin.json", "/assets/x.js", "/widget-assets/_astro/x.js", "/.well-known/oauth-protected-resource"]) {
      expect(isServerPath(p), p).toBe(true);
    }
  });
  it("lets Astro handle widget pages and its own assets", () => {
    for (const p of ["/widgets/simpleSalary", "/_astro/index.abc.js", "/some-user-page", "/mcpanything"]) {
      expect(isServerPath(p), p).toBe(false);
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
});

describe("qrtlPlugin integration", () => {
  function runSetup(output: string, options?: Parameters<typeof qrtlPlugin>[0]) {
    const integ = qrtlPlugin(options);
    let vitePlugins: { name: string }[] = [];
    let updatedConfig: Record<string, unknown> = {};
    let middleware: { entrypoint: string | URL; order: string } | undefined;
    const warnings: string[] = [];
    const opts: AstroConfigSetupOptions = {
      config: { output, root: "/proj" },
      updateConfig: (c) => {
        updatedConfig = c;
        vitePlugins = ((c as { vite?: { plugins?: { name: string }[] } }).vite?.plugins) ?? [];
      },
      addMiddleware: (m) => {
        middleware = m;
      },
      logger: { warn: (m) => warnings.push(m), info: () => {} },
      command: "dev",
    };
    integ.hooks["astro:config:setup"]!(opts);
    return { integ, vitePlugins, updatedConfig, middleware, warnings };
  }

  it("has the expected name and hook", () => {
    const integ = qrtlPlugin();
    expect(integ.name).toBe("@quartal/plugin");
    expect(typeof integ.hooks["astro:config:setup"]).toBe("function");
  });

  it("adds the codegen + virtual-middleware vite plugins and mounts middleware", () => {
    const { vitePlugins, middleware } = runSetup("server");
    const names = vitePlugins.map((p) => p.name);
    expect(names).toContain("qrtl-plugin-codegen");
    expect(names).toContain("qrtl-plugin-middleware");
    expect(middleware?.entrypoint).toBe(PLUGIN_MIDDLEWARE_VIRTUAL_ID);
    expect(middleware?.order).toBe("pre");
  });

  it("warns when output is not on-demand-capable", () => {
    expect(runSetup("static").warnings.length).toBeGreaterThan(0);
    expect(runSetup("server").warnings.length).toBe(0);
  });

  it("hides the Astro dev toolbar by default, keeps it with devToolbar: true", () => {
    expect(runSetup("server").updatedConfig.devToolbar).toEqual({ enabled: false });
    expect(runSetup("server", { devToolbar: true }).updatedConfig.devToolbar).toBeUndefined();
  });

  it("virtual-middleware plugin resolves/loads generated server source", () => {
    const { vitePlugins } = runSetup("server");
    const plugin = vitePlugins.find((p) => p.name === "qrtl-plugin-middleware") as unknown as {
      resolveId(id: string): string | undefined;
      load(id: string): string | undefined;
    };
    const resolved = plugin.resolveId(PLUGIN_MIDDLEWARE_VIRTUAL_ID);
    expect(resolved).toBe("\0" + PLUGIN_MIDDLEWARE_VIRTUAL_ID);
    const src = plugin.load(resolved!)!;
    expect(src).toContain("tools.registry.ts");
    expect(src).toContain("prompts.registry.ts");
    expect(src).toContain("promptModules");
    expect(src).toContain("getAnonApp");
    expect(src).toContain("createPluginMiddleware");
  });
});

describe("buildPluginMiddlewareSource", () => {
  it("uses getAnonApp for anon and getAuthApp for quartal-iam", () => {
    const anon = buildPluginMiddlewareSource({ auth: "anon", registryImport: "/src/qrtl-plugin/tools.registry.ts" });
    expect(anon).toContain("getAnonApp");
    expect(anon).not.toContain("getAuthApp");

    const iam = buildPluginMiddlewareSource({ auth: "quartal-iam", root: "/proj", registryImport: "/src/qrtl-plugin/tools.registry.ts" });
    expect(iam).toContain("getAuthApp");
    expect(iam).toContain('pluginRootFolder: "/proj"');
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
});
