import type { SkillFileEntry } from "./SkillFileEntry.ts";

/** One valid skill found under `<plugin>/skills/<name>/` by the plugin's skill discovery. */
export interface SkillEntry {
  /** Skill identifier (the folder name under `skills/`). */
  name: string;
  /** What the skill does and when to use it. */
  description: string;
  /** SPDX license identifier or license text. */
  license?: string;
  /** Runtime or environment compatibility notes. */
  compatibility?: string;
  /** Arbitrary key/value metadata from frontmatter. */
  metadata?: Record<string, unknown>;
  /** Files of the skill, sorted by path. */
  files: SkillFileEntry[];
}
