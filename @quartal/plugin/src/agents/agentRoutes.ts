import { join } from "node:path";
import type { Hono } from "hono";

import type { AgentDefinition, AgentsCatalog, AgentsCatalogResponse, PluginManifest } from "../model/index.ts";
import { Helpers } from "../helpers/Helpers.ts";
import { discoverSkills } from "../hono-app/skillDiscovery.ts";
import { discoverAgents, type DiscoverAgentsOptions } from "./discoverAgents.ts";
import { isValidAgentName } from "./resolveAgent.ts";
import { toAgentMarkdown } from "./toAgentMarkdown.ts";

/** Options for {@link registerAgentRoutes}. */
export interface AgentRoutesOptions extends Omit<DiscoverAgentsOptions, "pluginSkills"> {
  /** Skill names of this plugin. Discovered from `skills/` when omitted. */
  pluginSkills?: readonly string[];
}

function enrichCatalog(catalog: AgentsCatalog, origin: string): AgentsCatalogResponse {
  return {
    version: catalog.version,
    plugin: catalog.plugin,
    agents: catalog.agents.map((agent) => ({
      ...agent,
      urls: {
        markdown: `${origin}/agents/${agent.name}.md`,
        json: `${origin}/agents/${agent.name}.json`,
        html: `${origin}/agents.html?agent=${encodeURIComponent(agent.name)}`,
      },
    })),
  };
}

/** Serves the agent's markdown: the authored file for markdown agents, a rendering for JSON ones. */
async function agentMarkdown(baseDir: string, agent: AgentDefinition): Promise<string> {
  if (agent.source.toLowerCase().endsWith(".md")) {
    const raw = await Helpers.readIfExists(join(baseDir, agent.source));
    if (raw) return raw;
  }
  return toAgentMarkdown(agent);
}

/**
 * Serves the plugin's agents: the catalog, each agent as Claude-format markdown, and each agent
 * as a resolved JSON definition.
 * @param app Hono app to register routes on.
 * @param pluginRootFolder Plugin root (defaults to cwd).
 * @param manifest Plugin manifest (loaded on demand if omitted).
 * @param options Plugin tools/skills used to resolve the agents' references.
 */
export function registerAgentRoutes(
  app: Hono,
  pluginRootFolder?: string,
  manifest?: PluginManifest,
  options: AgentRoutesOptions = {},
): void {
  const baseDir = pluginRootFolder ?? process.cwd();

  const loadCatalog = async (): Promise<AgentsCatalog> => {
    const info = manifest ?? await Helpers.getPluginManifest(baseDir);
    const pluginSkills = options.pluginSkills ??
      (await discoverSkills(baseDir, info.name)).skills.map((s) => s.name);
    return await discoverAgents(baseDir, info.name, { ...options, pluginSkills });
  };

  const findAgent = async (name: string): Promise<AgentDefinition | null> => {
    if (!isValidAgentName(name)) return null;
    const catalog = await loadCatalog();
    return catalog.agents.find((a) => a.name === name) ?? null;
  };

  app.get("/agents/catalog.json", async (c) => {
    const catalog = await loadCatalog();
    return c.json(enrichCatalog(catalog, new URL(c.req.url).origin));
  });

  app.get("/agents/:file{.+\\.md$}", async (c) => {
    const name = (c.req.param("file") ?? "").replace(/\.md$/, "");
    const agent = await findAgent(name);
    if (!agent) return c.text("Not found", 404);
    const markdown = await agentMarkdown(baseDir, agent);
    return c.body(markdown, 200, { "Content-Type": "text/markdown; charset=utf-8" });
  });

  app.get("/agents/:file{.+\\.json$}", async (c) => {
    const name = (c.req.param("file") ?? "").replace(/\.json$/, "");
    const agent = await findAgent(name);
    if (!agent) return c.text("Not found", 404);
    return c.json(agent);
  });
}
