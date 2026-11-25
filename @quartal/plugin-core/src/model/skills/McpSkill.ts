import type { McpSkillResource } from "./McpSkillResource.ts";
import type { SkillFrontmatter } from "./SkillFrontmatter.ts";

/**
 * One skill in a `skills/list` result of the MCP Skills extension (`io.modelcontextprotocol/skills`).
 */
export interface McpSkill {
  /** URI of the skill's `SKILL.md` (e.g. `skill://invoicing/SKILL.md`); identifies the skill. */
  uri: string;
  /** The `SKILL.md` frontmatter, every field verbatim. */
  frontmatter: SkillFrontmatter;
  /** Every file of the skill, `SKILL.md` included — or `"dynamic"` for generated content. */
  resources: McpSkillResource[] | "dynamic";
}
