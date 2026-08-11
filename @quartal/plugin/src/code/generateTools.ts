import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { WidgetCatalogEntry } from "../model/index.ts";
import { buildPluginArtifacts, writePluginArtifacts, writeJsonToFile } from "./buildPluginArtifacts.ts";
import { Helpers } from "../helpers/Helpers.ts";
import { buildToolsRegistrySource } from "./buildToolsRegistry.ts";
import { buildPluginInfo, buildSkillSummaries } from "../hono-app/buildPluginInfo.ts";

/**
 * Options for generating the `qrtl-plugin/` artifacts.
 */
export interface GenerateToolsOptions {
  /** Plugin root directory. Entry/out and metadata (manifest, skills, README) resolve against it. Default: `process.cwd()`. */
  cwd?: string;
  /** Entry module path, relative to `cwd`. Default: `./tools/mod.ts`. */
  entry?: string;
  /** Output directory, relative to `cwd`. Created if missing. Default: `./qrtl-plugin`. */
  out?: string;
  /** API base path used in open-api.json (default: /api). */
  basePath?: string;
  /** Default HTTP method for routes in open-api.json (default: post). */
  defaultMethod?: "get" | "post";
  /**
   * Widget catalog entries (tool ids that have a UI). Supplied by the caller — widget discovery is
   * framework-specific and provided by the Astro integration (scanning `src/pages/widgets/`).
   * Default: `[]`.
   */
  widgets?: WidgetCatalogEntry[];
  /** Emit the static `tools.registry.ts` import map alongside the JSON artifacts (default: true). */
  emitRegistry?: boolean;
  /** Import base used inside the generated registry (relative to `out`). Default: `../tools`. */
  registryImportBase?: string;
}

/**
 * Generates hub artifacts under `<out>/`:
 * - tools.json (CodeFile[] including system types)
 * - open-api.json (OpenAPI 3.0, validated at build time)
 * - mcp-tools.json (MCP tool definitions with JSON Schema inputs)
 * - types.json (named type definitions)
 * - contents.json (unified plugin overview served at `GET /plugin.json`)
 * - tools.registry.ts (static tool-module import map for runtime execution)
 *
 * Pure Node (no Deno). Type introspection is done with the TypeScript compiler via ts-morph — see
 * {@link TsMorphAnalyzer}.
 * @param options Generation options (plugin root, entry module, output directory, widgets, etc.).
 */
export async function generateTools(options?: GenerateToolsOptions): Promise<void> {
  const cwd = options?.cwd ?? process.cwd();
  const entry = resolve(cwd, options?.entry ?? "./tools/mod.ts");
  const out = resolve(cwd, (options?.out ?? "./qrtl-plugin").replace(/\/$/, ""));
  const widgets = options?.widgets ?? [];

  await mkdir(out, { recursive: true });

  // Lazy import so that merely importing `@quartal/plugin` at runtime never pulls ts-morph (a build-time
  // dependency) into the deployed server graph — codegen only runs at build time.
  const { TsMorphAnalyzer } = await import("./TsMorphAnalyzer.ts");
  const files = new TsMorphAnalyzer().analyzeEntry(entry, { cwd });
  const manifest = await Helpers.getPluginManifest(cwd);

  let artifacts;
  try {
    artifacts = buildPluginArtifacts(files, manifest, {
      basePath: options?.basePath,
      defaultMethod: options?.defaultMethod,
      widgets,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to build OpenAPI/MCP artifacts: ${message}`, { cause: error });
  }

  await writePluginArtifacts(artifacts, out);

  if (options?.emitRegistry ?? true) {
    const registry = buildToolsRegistrySource(artifacts.files, { importBase: options?.registryImportBase });
    await writeFile(join(out, "tools.registry.ts"), registry);
  }

  const basePath = options?.basePath ?? "/api";
  const defaultMethod = options?.defaultMethod ?? "post";
  const skills = await buildSkillSummaries(cwd, manifest.name);
  const hasReadme = !!(await Helpers.readIfExists(join(cwd, "README.md")));
  const contents = buildPluginInfo({
    manifest,
    codeFiles: artifacts.files,
    mcpTools: artifacts.mcpTools,
    resources: artifacts.mcpCatalog.resources,
    prompts: artifacts.mcpCatalog.prompts,
    widgetCatalog: widgets,
    skills,
    basePath,
    defaultMethod,
    hasReadme,
  });
  await writeJsonToFile(join(out, "contents.json"), contents);
}
