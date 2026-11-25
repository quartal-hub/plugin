import { skillHttpUrls, type SkillHttpUrls } from "@quartal/plugin-core";
import { pluginClient } from "./pluginClient.ts";

/** A skill of the plugin as the docs pages show it: its frontmatter text plus its HTTP files. */
export interface DocsSkill extends SkillHttpUrls {
  /** `description` from the `SKILL.md` frontmatter. */
  description: string;
}

/**
 * Loads the plugin's skills from `GET /mcp/skills.json` (the MCP `skills/list` result) and maps
 * each to its plain-HTTP files and zip download.
 */
export async function loadSkills(): Promise<DocsSkill[]> {
  const list = await pluginClient.getMcpSkills();
  const origin = pluginClient.url("/").replace(/\/$/, "");
  return list.skills.flatMap((skill) => {
    const urls = skillHttpUrls(origin, skill);
    return urls ? [{ ...urls, description: String(skill.frontmatter.description ?? "") }] : [];
  });
}
