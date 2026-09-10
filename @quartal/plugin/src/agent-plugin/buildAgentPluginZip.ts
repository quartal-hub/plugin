import { stat } from "node:fs/promises";
import { join } from "node:path";

import type { McpServerOptions, PluginInfo, PluginManifest } from "../model/index.ts";
import { QUARTAL_EXTENSION_NAMESPACE } from "../model/index.ts";
import { Helpers } from "../helpers/Helpers.ts";
import { buildFilesZip, collectZipEntries, type ZipFileEntry } from "../hono-app/skillZip.ts";
import { buildAgentPluginManifest, buildClaudePluginManifest, buildQuartalExtension } from "./buildAgentPluginManifest.ts";
import { buildMcpServersConfig } from "./buildMcpServersConfig.ts";

const encoder = new TextEncoder();

function jsonEntry(path: string, value: unknown): ZipFileEntry {
  return { path, data: encoder.encode(JSON.stringify(value, null, 2) + "\n") };
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Inputs for {@link buildAgentPluginZip}. */
export interface BuildAgentPluginZipInput {
  /** Resolved plugin manifest. */
  manifest: PluginManifest;
  /** MCP options (`qrtl.config` `mcp`). */
  mcpOptions?: McpServerOptions;
  /** Absolute origin the plugin's hosted MCP/REST endpoints are reachable on. */
  origin: string;
  /** The plugin overview (packaged as the Quartal extension's `contents.json`). */
  pluginInfo: PluginInfo;
  /** Plugin root folder (source of `skills/`, `agents/` and `README.md`). */
  pluginRootFolder: string;
  /** Tool ids that have an MCP Apps widget (listed in the Quartal extension). */
  widgetToolIds?: string[];
}

/**
 * Assembles the installable Agent Plugins 1.0 package served at `GET /plugin.zip`:
 * the standard manifests (`plugin.json`, `mcp.json`), the Claude dual manifests
 * (`.claude-plugin/plugin.json`, `.mcp.json`), the plugin's skills, agents and README, and the
 * Quartal overview under `com.quartal.plugin/`. Tools are not packaged — the `mcp.json` servers
 * point at this plugin's hosted endpoints on `origin`.
 * @param input Package inputs.
 */
export async function buildAgentPluginZip(input: BuildAgentPluginZipInput): Promise<Uint8Array> {
  const { manifest, mcpOptions, origin, pluginRootFolder } = input;
  const extension = buildQuartalExtension(input.widgetToolIds);

  const entries: ZipFileEntry[] = [
    jsonEntry("plugin.json", buildAgentPluginManifest(manifest, origin, extension)),
    jsonEntry("mcp.json", buildMcpServersConfig(manifest, mcpOptions, origin, "standard")),
    jsonEntry(".claude-plugin/plugin.json", buildClaudePluginManifest(manifest, origin)),
    jsonEntry(".mcp.json", buildMcpServersConfig(manifest, mcpOptions, origin, "claude")),
    jsonEntry(`${QUARTAL_EXTENSION_NAMESPACE}/contents.json`, input.pluginInfo),
  ];

  for (const dir of ["skills", "agents"]) {
    const abs = join(pluginRootFolder, dir);
    if (await isDirectory(abs)) {
      entries.push(...(await collectZipEntries(abs, dir)));
    }
  }

  const readme = await Helpers.readIfExists(join(pluginRootFolder, "README.md"));
  if (readme !== undefined) {
    entries.push({ path: "README.md", data: encoder.encode(readme) });
  }

  return buildFilesZip(entries);
}
