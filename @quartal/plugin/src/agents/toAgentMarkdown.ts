import type { AgentDefinition } from "../model/index.ts";

/** Quotes a scalar when plain YAML would misread it. */
function scalar(value: string): string {
  const needsQuotes = value === "" ||
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(value) ||
    /:\s|\s#|^\s|\s$/.test(value) ||
    /^(true|false|null|~|-?\d+(\.\d+)?)$/i.test(value);
  return needsQuotes ? `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"` : value;
}

/** Writes a possibly multi-line value as either a scalar or a `|-` block. */
function multiline(key: string, value: string, indent = ""): string {
  if (!value.includes("\n")) return `${indent}${key}: ${scalar(value)}\n`;
  const body = value.split("\n").map((line) => `${indent}  ${line}`.trimEnd()).join("\n");
  return `${indent}${key}: |-\n${body}\n`;
}

/**
 * Renders an agent back to the Claude agent format: YAML frontmatter plus the system prompt.
 *
 * This is the interchange format — it is what `GET /agents/<name>.md` serves and what a plugin
 * consumer drops into `.claude/agents/`, whether the agent was authored as markdown or as JSON.
 * Model and color are written in their authored notation so a Claude host reads them natively;
 * the resolved, provider-qualified values stay in the JSON catalog.
 * @param agent Resolved agent definition.
 */
export function toAgentMarkdown(agent: AgentDefinition): string {
  let out = "---\n";
  out += `name: ${scalar(agent.name)}\n`;
  out += multiline("description", agent.description);
  if (agent.model) out += `model: ${scalar(agent.model.value)}\n`;
  if (agent.tools?.length) out += `tools: ${agent.tools.map((t) => t.name).join(", ")}\n`;
  if (agent.disallowedTools?.length) {
    out += `disallowedTools: ${agent.disallowedTools.map((t) => t.name).join(", ")}\n`;
  }
  if (agent.skills?.length) out += `skills: [${agent.skills.map(scalar).join(", ")}]\n`;
  if (agent.permissionMode) out += `permissionMode: ${agent.permissionMode}\n`;
  if (agent.maxTurns !== undefined) out += `maxTurns: ${agent.maxTurns}\n`;
  if (agent.effort) out += `effort: ${agent.effort}\n`;
  if (agent.isolation && agent.isolation !== "none") out += `isolation: ${agent.isolation}\n`;
  if (agent.color) out += `color: ${scalar(agent.color.claude ?? agent.color.value)}\n`;
  if (agent.initialPrompt) out += multiline("initialPrompt", agent.initialPrompt);
  if (agent.mcpServers?.length) {
    out += "mcpServers:\n";
    for (const server of agent.mcpServers) {
      out += `  ${scalar(server.name)}:\n`;
      out += `    type: ${server.type}\n`;
      out += `    url: ${scalar(server.url)}\n`;
      if (server.description) out += multiline("description", server.description, "    ");
      if (server.headers && Object.keys(server.headers).length > 0) {
        out += "    headers:\n";
        for (const [key, value] of Object.entries(server.headers)) {
          out += `      ${scalar(key)}: ${scalar(value)}\n`;
        }
      }
    }
  }
  out += "---\n";
  return agent.prompt ? `${out}\n${agent.prompt}\n` : out;
}
