import type { AgentToolRef } from "../model/index.ts";

/**
 * Tools an agent may name without declaring them anywhere: the file, search and web tools that
 * essentially every agent host provides. Anything else must be a tool of the agent's own plugin
 * or come from one of its `mcpServers`.
 */
export const ENVIRONMENT_TOOLS: readonly string[] = [
  "Agent",
  "Bash",
  "Edit",
  "Glob",
  "Grep",
  "NotebookEdit",
  "Read",
  "Task",
  "TodoWrite",
  "WebFetch",
  "WebSearch",
  "Write",
];

/** Prefix MCP hosts use to namespace server tools: `mcp__<server>__<tool>`. */
const MCP_PREFIX = "mcp__";

/** Inputs for resolving a tool name to its origin. */
export interface ResolveAgentToolsOptions {
  /** MCP tool ids exposed by the plugin that ships the agent. */
  pluginTools?: readonly string[];
  /** MCP server name of the plugin itself, so `mcp__<plugin>__<tool>` resolves to a plugin tool. */
  pluginServer?: string;
  /** Tool names the host is expected to provide. Defaults to {@link ENVIRONMENT_TOOLS}. */
  environmentTools?: readonly string[];
}

/** Strips an `Agent(name)` / `Task(name)` argument so the base tool name can be matched. */
function baseName(name: string): string {
  const paren = name.indexOf("(");
  return paren === -1 ? name : name.slice(0, paren).trim();
}

/**
 * Resolves one tool name to where the tool comes from.
 *
 * Plain names are matched against the plugin's own tools first, then the known environment tools;
 * `mcp__<server>__<tool>` names an MCP server tool, and anything containing `*` is a pattern
 * (`mcp__*` denies every MCP tool). Unmatched names are kept verbatim as `unknown` rather than
 * dropped — the host may know tools this plugin does not.
 * @param name Tool name as authored.
 * @param options Plugin tools and environment tools to resolve against.
 */
export function resolveAgentToolRef(name: string, options: ResolveAgentToolsOptions = {}): AgentToolRef {
  const raw = name.trim();
  if (raw.includes("*")) return { name: raw, kind: "pattern" };

  const pluginTools = options.pluginTools ?? [];
  const environmentTools = options.environmentTools ?? ENVIRONMENT_TOOLS;

  if (raw.startsWith(MCP_PREFIX)) {
    const rest = raw.slice(MCP_PREFIX.length);
    const split = rest.indexOf("__");
    const server = split === -1 ? rest : rest.slice(0, split);
    const serverTool = split === -1 ? undefined : rest.slice(split + 2);
    if (options.pluginServer && server === options.pluginServer && serverTool && pluginTools.includes(serverTool)) {
      return { name: raw, kind: "plugin", toolId: serverTool, server, serverTool };
    }
    return { name: raw, kind: "mcp", server, ...(serverTool ? { serverTool } : {}) };
  }

  const base = baseName(raw);
  if (pluginTools.includes(base)) return { name: raw, kind: "plugin", toolId: base };

  const environment = environmentTools.find((t) => t.toLowerCase() === base.toLowerCase());
  if (environment) return { name: raw, kind: "environment" };

  return { name: raw, kind: "unknown" };
}

/** Resolves a list of tool names, dropping empties and duplicates.
 * @param names Tool names as authored.
 * @param options Plugin tools and environment tools to resolve against.
 */
export function resolveAgentTools(names: readonly string[], options: ResolveAgentToolsOptions = {}): AgentToolRef[] {
  const seen = new Set<string>();
  const refs: AgentToolRef[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    refs.push(resolveAgentToolRef(trimmed, options));
  }
  return refs;
}
