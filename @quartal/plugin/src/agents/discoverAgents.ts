import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { AgentDefinition, AgentsCatalog } from "../model/index.ts";
import { Helpers } from "../helpers/Helpers.ts";
import { parseAgentFile, type ParsedAgentFile } from "./parseAgentFile.ts";
import { resolveAgent, type ResolveAgentOptions } from "./resolveAgent.ts";

/** Directory (under the plugin root) agents are discovered from. */
export const AGENTS_DIR = "agents";

/** File extensions an agent may be written in. */
const AGENT_EXTENSIONS = [".md", ".json"];

/** Files inside `agents/` that are documentation, not agents. */
const IGNORED_FILES = ["readme.md", "about.md"];

/** Inputs for {@link discoverAgents}. */
export interface DiscoverAgentsOptions extends Omit<ResolveAgentOptions, "name" | "source"> {
  /** Called for every problem found. Defaults to `console.warn`. */
  onWarning?: (message: string) => void;
}

/** Strips the extension from an agent file name. */
function stemOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? fileName : fileName.slice(0, dot);
}

/**
 * Discovers agents in `<baseDir>/agents/*.md` and `<baseDir>/agents/*.json`.
 *
 * Each file is parsed (Claude-format frontmatter, or a JSON object with the same fields) and
 * resolved into a host-neutral {@link AgentDefinition}. Files that cannot describe an agent are
 * skipped with a warning; agents that resolve with warnings are kept.
 * @param baseDir Plugin root directory.
 * @param pluginName Plugin name (for the agents catalog manifest).
 * @param options Plugin tools/skills to resolve references against, and a warning sink.
 */
export async function discoverAgents(
  baseDir: string,
  pluginName: string,
  options: DiscoverAgentsOptions = {},
): Promise<AgentsCatalog> {
  const warn = options.onWarning ?? ((message: string) => console.warn(`[discoverAgents] ${message}`));
  const agentsRoot = join(baseDir, AGENTS_DIR);

  let fileNames: string[];
  try {
    const entries = await readdir(agentsRoot, { withFileTypes: true });
    fileNames = entries
      .filter((e) => e.isFile() && !e.name.startsWith("."))
      .map((e) => e.name)
      .filter((n) => AGENT_EXTENSIONS.some((ext) => n.toLowerCase().endsWith(ext)))
      .filter((n) => !IGNORED_FILES.includes(n.toLowerCase()));
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return { version: "1.0", plugin: pluginName, agents: [] };
    throw e;
  }

  fileNames.sort((a, b) => a.localeCompare(b));

  const agents: AgentDefinition[] = [];
  const byName = new Map<string, string>();

  for (const fileName of fileNames) {
    const source = `${AGENTS_DIR}/${fileName}`;
    const raw = await Helpers.readIfExists(join(agentsRoot, fileName));
    if (!raw) continue;

    let parsed: ParsedAgentFile | null;
    try {
      parsed = parseAgentFile(raw, fileName);
    } catch (e) {
      // Malformed YAML/JSON: the parser message names the line and column that broke.
      warn(`${source}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (!parsed) {
      warn(`${source}: not an agent file (no frontmatter block)`);
      continue;
    }

    const { agent, warnings } = resolveAgent(parsed, { ...options, name: stemOf(fileName), source });
    for (const message of warnings) warn(`${source}: ${message}`);
    if (!agent) continue;

    const duplicate = byName.get(agent.name);
    if (duplicate) {
      warn(`${source}: agent "${agent.name}" is already defined in ${duplicate}`);
      continue;
    }
    byName.set(agent.name, source);
    agents.push(agent);
  }

  agents.sort((a, b) => a.name.localeCompare(b.name));
  return { version: "1.0", plugin: pluginName, agents };
}
