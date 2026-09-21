import { stat } from "node:fs/promises";
import { join } from "node:path";

import type { McpServerOptions, PluginFileMapEntry, PluginInfo, PluginManifest } from "../model/index.ts";
import { QUARTAL_EXTENSION_NAMESPACE } from "../model/index.ts";
import { fileMapBytes } from "../helpers/fileMap.ts";
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
  /** Plugin root folder (source of `skills/`, `agents/` and `README.md` when no file map is given). */
  pluginRootFolder: string;
  /** Tool ids that have an MCP Apps widget (listed in the Quartal extension). */
  widgetToolIds?: string[];
  /** Build-time file map; when present, `skills/` and `agents/` are packaged from it, not disk. */
  fileMap?: readonly PluginFileMapEntry[];
  /** README text resolved at build time; when set (with a file map), the disk read is skipped. */
  readme?: string;
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

  if (input.fileMap) {
    // The map holds exactly the skills/ and agents/ trees, already root-relative — the zip layout.
    entries.push(...input.fileMap.map((f) => ({ path: f.path, data: fileMapBytes(f) })));
  } else {
    for (const dir of ["skills", "agents"]) {
      const abs = join(pluginRootFolder, dir);
      if (await isDirectory(abs)) {
        entries.push(...(await collectZipEntries(abs, dir)));
      }
    }
  }

  // With a file map the snapshot is authoritative: an absent readme means the plugin has none.
  const readme = input.fileMap ? input.readme : await Helpers.readIfExists(join(pluginRootFolder, "README.md"));
  if (readme !== undefined) {
    entries.push({ path: "README.md", data: encoder.encode(readme) });
  }

  return buildFilesZip(entries);
}
