/** A file inside a skill folder, as found by the plugin's skill discovery. */
export interface SkillFileEntry {
  /** Path relative to the skill folder (e.g. `SKILL.md`, `scripts/run.ts`). */
  path: string;
  /** File size in bytes. */
  size: number;
  /** MIME type used when serving the file. */
  mimeType: string;
}
