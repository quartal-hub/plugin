import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateTools } from "../src/index.ts";
import type { WidgetCatalogEntry } from "../src/index.ts";

// End-to-end orchestration test: run generateTools against the committed `test1` fixture (real source)
// and assert the full chain (TsMorphAnalyzer → buildPluginArtifacts → writePluginArtifacts → registry →
// contents.json) produces the expected artifacts. The byte-exact variant lives in golden.test.ts.

const PKG_DIR = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

describe("generateTools (end-to-end, ts-morph analyzer)", () => {
  it("writes all qrtl-plugin artifacts + a static tools.registry.ts", async () => {
    const out = await mkdtemp(join(tmpdir(), "qrtl-gen-"));
    const widgets: WidgetCatalogEntry[] = [{ toolId: "sayHello", name: "Hello Widget" }];
    try {
      await generateTools({ cwd: PKG_DIR, out, widgets });

      const readJson = async (f: string) => JSON.parse(await readFile(join(out, f), "utf-8"));

      // tools.json: the analyzed tool classes are present.
      const tools = await readJson("tools.json") as { files: { classes: { name: string }[] }[] };
      const classNames = tools.files.flatMap((f) => f.classes.map((c) => c.name));
      expect(classNames).toContain("Calculator");
      expect(classNames).toContain("HelloWorld");
      expect(classNames).toContain("TypesTester");

      // mcp-tools.json: the expected tool methods were extracted with input schemas.
      const mcp = await readJson("mcp-tools.json") as { tools: { methodName: string }[] };
      const methods = mcp.tools.map((t) => t.methodName);
      for (const m of ["add", "multiply", "sayHello", "primitives"]) expect(methods).toContain(m);

      // open-api.json: a REST path per tool method.
      const openApi = await readJson("open-api.json") as { paths: Record<string, unknown> };
      expect(Object.keys(openApi.paths)).toContain("/api/Calculator/add");
      expect(Object.keys(openApi.paths)).toContain("/api/HelloWorld/sayHello");

      // types.json: named tool types resolved.
      const types = await readJson("types.json") as { name: string }[];
      expect(types.map((t) => t.name)).toContain("GreetingType");

      // contents.json: overview assembled with manifest + widgets + skills.
      const contents = await readJson("contents.json") as {
        name: string;
        tools: unknown[];
        widgets: { toolId: string }[];
        skills: { name: string }[];
      };
      expect(contents.name).toBe("@samples/test1");
      expect(contents.tools.length).toBeGreaterThan(0);
      expect(contents.widgets.map((w) => w.toolId)).toContain("sayHello");
      expect(contents.skills.length).toBeGreaterThan(0);

      // tools.registry.ts: static import map (replaces runtime dynamic path-import).
      const registry = await readFile(join(out, "tools.registry.ts"), "utf-8");
      expect(registry).toContain('from "../tools/Calculator.ts";');
      expect(registry).toContain('"Calculator":');
      expect(registry).toContain("export const toolModules");
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  it("skips widget metadata when no widgets are supplied (Astro discovery is separate)", async () => {
    const out = await mkdtemp(join(tmpdir(), "qrtl-gen-nowidgets-"));
    try {
      await generateTools({ cwd: PKG_DIR, out });
      const contents = JSON.parse(await readFile(join(out, "contents.json"), "utf-8")) as { widgets: unknown[] };
      expect(contents.widgets).toEqual([]);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});
