import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CreatePluginOptions } from "./CreatePluginOptions.ts";
import { scaffoldProject, titleFromName, unscopedName } from "./scaffoldProject.ts";

const baseOptions: CreatePluginOptions = {
  name: "my-plugin",
  description: "Test plugin.",
  auth: false,
  sampleTool: true,
  widgets: "vue",
};

describe("scaffoldProject", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "create-plugin-"));
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const readJson = async (dir: string, file: string) =>
    JSON.parse(await readFile(join(dir, file), "utf8")) as Record<string, any>;

  it("scaffolds the default Vue project with a sample tool", async () => {
    const dir = await scaffoldProject(baseOptions, cwd);

    for (const file of [
      ".gitignore",
      "tsconfig.json",
      "astro.config.mjs",
      "qrtl.config.ts",
      "README.md",
      "public/.gitkeep",
      "src/tools/mod.ts",
      "src/tools/HelloWorld.ts",
      "src/layouts/WidgetLayout.astro",
      "src/pages/widgets/sayHello.astro",
      "src/components/SayHello.vue",
    ]) {
      expect(existsSync(join(dir, file)), file).toBe(true);
    }

    const pkg = await readJson(dir, "package.json");
    expect(pkg.name).toBe("my-plugin");
    expect(pkg.private).toBe(true);
    expect(Object.keys(pkg.dependencies)).toEqual(
      ["@astrojs/node", "@astrojs/vue", "@quartal/plugin", "@quartal/plugin-vue", "astro", "vue"],
    );

    const qrtlConfig = await readFile(join(dir, "qrtl.config.ts"), "utf8");
    expect(qrtlConfig).toContain('title: "My Plugin"');
    expect(qrtlConfig).toContain('auth: "anon"');

    const tool = await readFile(join(dir, "src/tools/HelloWorld.ts"), "utf8");
    expect(tool).not.toContain("QuartalPluginContext");
  });

  it("scaffolds auth + React with the context-aware tool and React deps", async () => {
    const dir = await scaffoldProject({ ...baseOptions, name: "@org/hub-app", auth: true, widgets: "react" }, cwd);

    expect(dir.endsWith("hub-app")).toBe(true);
    const pkg = await readJson(dir, "package.json");
    expect(pkg.dependencies["@quartal/plugin-core"]).toBeDefined();
    expect(pkg.dependencies.react).toBeDefined();
    expect(pkg.devDependencies["@types/react"]).toBeDefined();

    const tool = await readFile(join(dir, "src/tools/HelloWorld.ts"), "utf8");
    expect(tool).toContain("QuartalPluginContext");

    const astroConfig = await readFile(join(dir, "astro.config.mjs"), "utf8");
    expect(astroConfig).toContain('qrtlPlugin({ auth: "quartal-iam" })');
    expect(astroConfig).toContain("react()");
    expect(existsSync(join(dir, "src/components/SayHello.tsx"))).toBe(true);
  });

  it("scaffolds a bare project without a sample tool or widgets", async () => {
    const dir = await scaffoldProject({ ...baseOptions, sampleTool: false, widgets: "none" }, cwd);

    expect(existsSync(join(dir, "src/tools/HelloWorld.ts"))).toBe(false);
    expect(existsSync(join(dir, "src/pages"))).toBe(false);
    expect(existsSync(join(dir, "src/layouts"))).toBe(false);
    expect(await readFile(join(dir, "src/tools/mod.ts"), "utf8")).toContain("export {};");

    const pkg = await readJson(dir, "package.json");
    expect(Object.keys(pkg.dependencies)).toEqual(["@astrojs/node", "@quartal/plugin", "astro"]);
    expect(pkg.devDependencies).toBeUndefined();
  });

  it("scaffolds the plain JavaScript widget without framework deps", async () => {
    const dir = await scaffoldProject({ ...baseOptions, widgets: "js" }, cwd);

    expect(existsSync(join(dir, "src/pages/widgets/sayHello.astro"))).toBe(true);
    expect(existsSync(join(dir, "src/components"))).toBe(false);
    const pkg = await readJson(dir, "package.json");
    expect(Object.keys(pkg.dependencies)).toEqual(["@astrojs/node", "@quartal/plugin", "astro"]);
  });

  it("refuses a non-empty target directory", async () => {
    await scaffoldProject(baseOptions, cwd);
    await expect(scaffoldProject(baseOptions, cwd)).rejects.toThrow(/already exists/);
  });
});

describe("name helpers", () => {
  it("derives directory and title from scoped names", () => {
    expect(unscopedName("@org/my-plugin")).toBe("my-plugin");
    expect(titleFromName("@org/my-cool.plugin")).toBe("My Cool Plugin");
    expect(titleFromName("plugin")).toBe("Plugin");
  });
});
