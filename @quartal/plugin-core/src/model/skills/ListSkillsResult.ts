import type { McpSkill } from "./McpSkill.ts";

/**
 * Result of the MCP `skills/list` method (Skills extension), also served at `GET /mcp/skills.json`.
 */
export interface ListSkillsResult {
  /** The skills, sorted by URI. */
  skills: McpSkill[];
  /** Cursor of the next page, when there is one. */
  nextCursor?: string;
}
