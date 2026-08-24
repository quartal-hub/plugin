import type {
  AgentDefinition,
  AgentEffort,
  AgentIsolation,
  AgentMcpServer,
  AgentPermissionMode,
} from "../model/index.ts";
import type { ParsedAgentFile } from "./parseAgentFile.ts";
import { resolveAgentColor } from "./resolveAgentColor.ts";
import { resolveAgentModel } from "./resolveAgentModel.ts";
import { resolveAgentTools, type ResolveAgentToolsOptions } from "./resolveAgentTools.ts";

const AGENT_NAME_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const PERMISSION_MODES: AgentPermissionMode[] = [
  "default",
  "plan",
  "acceptEdits",
  "auto",
  "dontAsk",
  "bypassPermissions",
  "manual",
];
const EFFORTS: AgentEffort[] = ["low", "medium", "high", "xhigh", "max"];
const ISOLATIONS: AgentIsolation[] = ["none", "worktree"];

/** Inputs for {@link resolveAgent}. */
export interface ResolveAgentOptions extends ResolveAgentToolsOptions {
  /** Fallback name when the file declares none (normally the file stem). */
  name: string;
  /** Source path relative to the plugin root (e.g. `agents/invoice-writer.md`). */
  source: string;
  /** Skill names shipped by the plugin; references to anything else are dropped with a warning. */
  pluginSkills?: readonly string[];
}

/** A resolved agent plus everything questionable found while resolving it. */
export interface ResolvedAgent {
  /** The resolved agent, or `null` when the file cannot describe one. */
  agent: AgentDefinition | null;
  /** Human-readable problems: unknown enum values, dropped skills, unusable MCP servers. */
  warnings: string[];
}

/** Validates an agent `name` (same shape as an Agent Skills name). */
export function isValidAgentName(name: string): boolean {
  if (name.length < 1 || name.length > 64) return false;
  if (name.includes("--")) return false;
  return AGENT_NAME_RE.test(name);
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

/** Reads a list field written either as a YAML sequence or as a comma/space separated string. */
function asStringList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map((v) => asString(v) ?? "").filter(Boolean);
  const text = asString(value);
  if (!text) return [];
  return text.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
}

function asPositiveInteger(value: unknown): number | undefined {
  const num = typeof value === "number" ? value : Number(asString(value));
  return Number.isInteger(num) && num > 0 ? num : undefined;
}

function asEnum<T extends string>(value: unknown, allowed: T[]): T | undefined {
  const text = asString(value);
  if (!text) return undefined;
  return allowed.find((a) => a.toLowerCase() === text.toLowerCase());
}

/** Reads `mcpServers` as either a list of definitions or a name-keyed map (the Claude shape). */
function resolveMcpServers(value: unknown, warnings: string[]): AgentMcpServer[] {
  if (!value || typeof value !== "object") return [];
  const raw: Array<[string | undefined, unknown]> = Array.isArray(value)
    ? value.map((v) => [undefined, v])
    : Object.entries(value);

  const servers: AgentMcpServer[] = [];
  for (const [key, entry] of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      warnings.push(`mcpServers: entry "${key ?? "?"}" is not a server definition`);
      continue;
    }
    const fields = entry as Record<string, unknown>;
    const name = asString(fields.name) ?? key;
    const url = asString(fields.url);
    const type = (asString(fields.type) ?? "http").toLowerCase();

    if (!name) {
      warnings.push("mcpServers: a server is missing its name");
      continue;
    }
    if (type !== "http" && type !== "https" && type !== "streamable-http") {
      warnings.push(`mcpServers: "${name}" uses transport "${type}" — only remote http servers are supported`);
      continue;
    }
    if (!url || !isRemoteHttpUrl(url)) {
      warnings.push(`mcpServers: "${name}" needs an https url (http is allowed on localhost only)`);
      continue;
    }
    const headers = asHeaders(fields.headers);
    const description = asString(fields.description);
    servers.push({
      name,
      type: "http",
      url,
      ...(headers ? { headers } : {}),
      ...(description ? { description } : {}),
    });
  }
  return servers;
}

function isRemoteHttpUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") return true;
  return parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
}

function asHeaders(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const headers: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    const text = asString(item);
    if (text) headers[key] = text;
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

/**
 * Turns a parsed agent file into a resolved {@link AgentDefinition}.
 *
 * Every Claude-specific notation is normalized here: models gain their provider, colors gain
 * their Bootstrap and CSS equivalents, and tool names are matched against the plugin's own tools,
 * the known environment tools and the agent's MCP servers. Unusable values are dropped and
 * reported in {@link ResolvedAgent.warnings} rather than failing the whole agent.
 * @param file Fields and system prompt from {@link parseAgentFile}.
 * @param options Name/source fallbacks and the plugin's tools and skills.
 */
export function resolveAgent(file: ParsedAgentFile, options: ResolveAgentOptions): ResolvedAgent {
  const warnings: string[] = [];
  const { fields, prompt } = file;

  const name = asString(fields.name) ?? options.name;
  const description = asString(fields.description);
  if (!isValidAgentName(name)) {
    return { agent: null, warnings: [`invalid agent name "${name}"`] };
  }
  if (!description) {
    return { agent: null, warnings: ["missing `description`"] };
  }

  const mcpServers = resolveMcpServers(fields.mcpServers, warnings);
  const toolOptions: ResolveAgentToolsOptions = {
    pluginTools: options.pluginTools,
    pluginServer: options.pluginServer,
    environmentTools: options.environmentTools,
  };
  const tools = resolveAgentTools(asStringList(fields.tools), toolOptions);
  const disallowedTools = resolveAgentTools(asStringList(fields.disallowedTools), toolOptions);
  for (const tool of tools) {
    if (tool.kind === "unknown") warnings.push(`tools: "${tool.name}" is not a plugin tool or a known host tool`);
    if (tool.kind === "mcp" && !mcpServers.some((s) => s.name === tool.server)) {
      warnings.push(`tools: "${tool.name}" references undeclared MCP server "${tool.server}"`);
    }
  }

  const skills: string[] = [];
  for (const skill of asStringList(fields.skills)) {
    if (options.pluginSkills && !options.pluginSkills.includes(skill)) {
      warnings.push(`skills: "${skill}" is not a skill of this plugin`);
      continue;
    }
    skills.push(skill);
  }

  const modelValue = asString(fields.model);
  const model = modelValue ? resolveAgentModel(modelValue) : undefined;
  const colorValue = asString(fields.color);
  const color = colorValue ? resolveAgentColor(colorValue) : undefined;

  const permissionMode = asEnum(fields.permissionMode, PERMISSION_MODES);
  if (fields.permissionMode !== undefined && !permissionMode) {
    warnings.push(`permissionMode: unknown value "${asString(fields.permissionMode)}"`);
  }
  const effort = asEnum(fields.effort, EFFORTS);
  if (fields.effort !== undefined && !effort) warnings.push(`effort: unknown value "${asString(fields.effort)}"`);
  const isolation = asEnum(fields.isolation, ISOLATIONS);
  if (fields.isolation !== undefined && !isolation) {
    warnings.push(`isolation: unknown value "${asString(fields.isolation)}"`);
  }
  const maxTurns = asPositiveInteger(fields.maxTurns);
  if (fields.maxTurns !== undefined && maxTurns === undefined) {
    warnings.push(`maxTurns: expected a positive integer, got "${asString(fields.maxTurns)}"`);
  }
  const initialPrompt = asString(fields.initialPrompt);

  return {
    agent: {
      name,
      description,
      prompt,
      ...(initialPrompt ? { initialPrompt } : {}),
      ...(tools.length > 0 ? { tools } : {}),
      ...(disallowedTools.length > 0 ? { disallowedTools } : {}),
      ...(mcpServers.length > 0 ? { mcpServers } : {}),
      ...(skills.length > 0 ? { skills } : {}),
      ...(model ? { model } : {}),
      ...(permissionMode ? { permissionMode } : {}),
      ...(maxTurns !== undefined ? { maxTurns } : {}),
      ...(effort ? { effort } : {}),
      ...(isolation ? { isolation } : {}),
      ...(color ? { color } : {}),
      source: options.source,
    },
    warnings,
  };
}
