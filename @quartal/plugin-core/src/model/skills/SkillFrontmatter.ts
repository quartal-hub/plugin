/**
 * The YAML frontmatter of a `SKILL.md` ([Agent Skills](https://agentskills.io/specification)).
 * `skills/list` carries every field verbatim; the ones the specification names are typed here.
 */
export interface SkillFrontmatter {
  /** Skill identifier; equals the skill's folder name. */
  name: string;
  /** What the skill does and when to use it. */
  description: string;
  /** SPDX license identifier or license text. */
  license?: string;
  /** Runtime or environment compatibility notes. */
  compatibility?: string;
  /** Arbitrary key/value metadata. */
  metadata?: Record<string, unknown>;
  /** Any further frontmatter field, unchanged. */
  [field: string]: unknown;
}
