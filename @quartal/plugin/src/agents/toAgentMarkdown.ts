import { stringify } from "yaml";

import type { AgentDefinition } from "../model/index.ts";

/** One MCP server as it appears in the frontmatter (the name is the map key). */
interface McpServerFields {
  type: string;
  url: string;
  description?: string;
  headers?: Record<string, string>;
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
  // Key order is the authoring order documented in docs/agents.md; `yaml` keeps insertion order.
  const fields: Record<string, unknown> = { name: agent.name, description: agent.description };
  if (agent.model) fields.model = agent.model.value;
  // Tool lists stay comma-separated strings: that is the Claude agent-format convention, and
  // `resolveAgent` splits them back apart on the way in.
  if (agent.tools?.length) fields.tools = agent.tools.map((t) => t.name).join(", ");
  if (agent.disallowedTools?.length) fields.disallowedTools = agent.disallowedTools.map((t) => t.name).join(", ");
  if (agent.skills?.length) fields.skills = agent.skills;
  if (agent.permissionMode) fields.permissionMode = agent.permissionMode;
  if (agent.maxTurns !== undefined) fields.maxTurns = agent.maxTurns;
  if (agent.effort) fields.effort = agent.effort;
  if (agent.isolation && agent.isolation !== "none") fields.isolation = agent.isolation;
  if (agent.color) fields.color = agent.color.claude ?? agent.color.value;
  if (agent.initialPrompt) fields.initialPrompt = agent.initialPrompt;
  if (agent.mcpServers?.length) {
    const servers: Record<string, McpServerFields> = {};
    for (const server of agent.mcpServers) {
      servers[server.name] = {
        type: server.type,
        url: server.url,
        ...(server.description ? { description: server.description } : {}),
        ...(server.headers && Object.keys(server.headers).length > 0 ? { headers: server.headers } : {}),
      };
    }
    fields.mcpServers = servers;
  }

  const frontmatter = stringify(fields, { lineWidth: 0 });
  return agent.prompt ? `---\n${frontmatter}---\n\n${agent.prompt}\n` : `---\n${frontmatter}---\n`;
}
