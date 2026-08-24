import type { AgentColor } from "./AgentColor.ts";
import type { AgentMcpServer } from "./AgentMcpServer.ts";
import type { AgentModelRef } from "./AgentModelRef.ts";
import type { AgentToolRef } from "./AgentToolRef.ts";

/**
 * How much the host may do without asking the user. Mirrors the Claude sub-agent permission
 * modes; hosts that only know "ask" and "don't ask" can treat everything but `default` and `plan`
 * as "don't ask".
 */
export type AgentPermissionMode =
  | "default"
  | "plan"
  | "acceptEdits"
  | "auto"
  | "dontAsk"
  | "bypassPermissions"
  | "manual";

/** Reasoning effort the agent asks for, when the host model supports it. */
export type AgentEffort = "low" | "medium" | "high" | "xhigh" | "max";

/** Whether the agent needs its own working copy of the project. */
export type AgentIsolation = "none" | "worktree";

/**
 * An agent shipped by a plugin: a named system prompt plus the tools, skills and runtime settings
 * it expects — the fourth Quartal primitive next to Tools, Widgets and Skills.
 *
 * The shape follows the Claude agent / sub-agent format (`agents/<name>.md` with YAML
 * frontmatter) but every Claude-specific value is resolved into a host-neutral one: models carry
 * their provider, colors carry Bootstrap and CSS equivalents, and tool names say where they come
 * from. Authored as markdown or JSON under `<plugin>/agents/`.
 */
export interface AgentDefinition {
  /** Agent identifier: lowercase letters, digits and single hyphens (the file stem by default). */
  name: string;
  /** What the agent is for and when a host should delegate to it. */
  description: string;
  /** System prompt: the markdown body of the agent file. */
  prompt: string;
  /** First user turn to submit automatically when the agent starts. */
  initialPrompt?: string;
  /** Tools the agent may use. Omitted means "everything the host offers". */
  tools?: AgentToolRef[];
  /** Tools the agent may never use; applied before {@link AgentDefinition.tools}. */
  disallowedTools?: AgentToolRef[];
  /** External MCP servers the agent connects to, in addition to its own plugin. */
  mcpServers?: AgentMcpServer[];
  /** Skills of this plugin to preload, by skill name. */
  skills?: string[];
  /** Model the agent runs on. Omitted means the host decides. */
  model?: AgentModelRef;
  /** Permission mode requested for the agent's session. */
  permissionMode?: AgentPermissionMode;
  /** Hard cap on agent loop iterations (tool-call rounds). */
  maxTurns?: number;
  /** Reasoning effort requested from the model. */
  effort?: AgentEffort;
  /** Workspace isolation requested for the agent. */
  isolation?: AgentIsolation;
  /** Accent color for hosts that list agents. */
  color?: AgentColor;
  /** Source file relative to the plugin root (e.g. `agents/invoice-writer.md`). */
  source: string;
}
