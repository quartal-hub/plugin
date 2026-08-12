import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { CodeFile, PluginManifest, McpCatalog, McpPromptDescriptor, WidgetCatalogEntry } from "../model/index.ts";
import { buildMcpCatalog } from "./buildMcpCatalog.ts";
import { buildMcpPrompts } from "./buildMcpPrompts.ts";
import { buildMcpTools } from "./buildMcpTools.ts";
import { buildOpenApiDocument } from "./buildOpenApiDocument.ts";
import { getSystemCodeFile } from "./getSystemCodeFile.ts";

/** Generated plugin artifacts written under `qrtl-plugin/` (one per kind of consumer). */
export interface PluginArtifacts {
  /** Analyzed code files, with the system types file prepended. */
  files: CodeFile[];
  /** OpenAPI 3 document describing the REST surface. */
  openApi: Record<string, unknown>;
  /** MCP tool descriptors (id, schema, etc.) — the execution-side metadata. */
  mcpTools: ReturnType<typeof buildMcpTools>;
  /** MCP prompt descriptors (id, arguments, etc.) from the plugin's `prompts/` entry. */
  mcpPrompts: McpPromptDescriptor[];
  /** In-memory MCP catalog (tools/resources/prompts/widgets); feeds `contents.json` (not written to disk). */
  mcpCatalog: McpCatalog;
  /** Flat list of all exported types across analyzed files. */
  types: unknown[];
}

/** Prepares code files with the system types file included.
 * @param files Analyzed code files from tools.json or the analyzer.
 */
export function prepareCodeFilesForPlugin(files: CodeFile[]): CodeFile[] {
  const hasSystem = files.some((f) => f.path === "__system__.ts");
  const withSystem = hasSystem ? files : [getSystemCodeFile(), ...files];
  return withSystem;
}

/** Builds all generated hub artifacts from analyzed code files.
 * @param files Analyzed code files from tools.json or the analyzer.
 * @param manifest Plugin manifest metadata.
 * @param options OpenAPI and widget generation options.
 */
export function buildPluginArtifacts(
  files: CodeFile[],
  manifest: PluginManifest,
  options?: {
    basePath?: string;
    defaultMethod?: "get" | "post";
    widgets?: WidgetCatalogEntry[];
    /** Analyzed code files from the plugin's `prompts/` entry (kept out of tools/REST artifacts). */
    promptFiles?: CodeFile[];
  },
): PluginArtifacts {
  const codeFiles = prepareCodeFilesForPlugin(files);

  const openApi = buildOpenApiDocument(codeFiles, manifest, options);
  const mcpTools = buildMcpTools(codeFiles);
  const mcpPrompts = options?.promptFiles?.length
    ? buildMcpPrompts(prepareCodeFilesForPlugin(options.promptFiles))
    : [];
  const mcpCatalog = buildMcpCatalog(codeFiles, options?.widgets, mcpPrompts);
  const types = codeFiles
    .filter((f) => f.path !== "__system__.ts")
    .flatMap((f) => f.types);

  return { files: codeFiles, openApi, mcpTools, mcpPrompts, mcpCatalog, types };
}

/** Writes pretty-printed JSON (matches `deno fmt`: 2-space indent + trailing newline).
 * @param path Output file path.
 * @param value JSON-serializable value to write.
 */
export async function writeJsonToFile(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}

/** Writes tools.json and companion artifacts under `out/`.
 * @param artifacts Generated hub artifacts to persist.
 * @param out Output directory (typically `./qrtl-plugin`).
 */
export async function writePluginArtifacts(
  artifacts: PluginArtifacts,
  out: string,
): Promise<void> {
  await mkdir(out, { recursive: true });
  await writeJsonToFile(join(out, "tools.json"), { files: artifacts.files });
  await writeJsonToFile(join(out, "open-api.json"), artifacts.openApi);
  await writeJsonToFile(join(out, "mcp-tools.json"), { tools: artifacts.mcpTools });
  await writeJsonToFile(join(out, "mcp-prompts.json"), { prompts: artifacts.mcpPrompts });
  await writeJsonToFile(join(out, "types.json"), artifacts.types);
}

