import type { McpSkill } from "../model/index.ts";

/** URI scheme of the skills a Quartal plugin serves over MCP. */
const SKILL_URI_PREFIX = "skill://";

/** One file of a skill with its plain-HTTP URL. */
export interface SkillHttpFile {
  /** Path relative to the skill folder (e.g. `SKILL.md`, `scripts/run.ts`). */
  path: string;
  /** File size in bytes. */
  size: number;
  /** Absolute (or plugin-relative) URL of the file. */
  url: string;
}

/** The plain-HTTP addresses of one skill a Quartal plugin serves. */
export interface SkillHttpUrls {
  /** The skill's name (its folder). */
  name: string;
  /** `SKILL.md`. */
  skillMd: string;
  /** The whole skill folder as a zip archive. */
  zip: string;
  /** Every file of the skill with its plain-HTTP URL. */
  files: SkillHttpFile[];
}

/**
 * Maps a `skills/list` entry of a Quartal plugin to the plugin's plain-HTTP skill routes:
 * `skill://<name>/<path>` is served at `<origin>/skills/<name>/<path>`.
 * @param origin The plugin origin (no trailing slash), or `""` for plugin-relative URLs.
 * @param skill The `skills/list` entry.
 * @returns The URLs, or `null` when the entry is not a `skill://<name>/SKILL.md` skill.
 */
export function skillHttpUrls(origin: string, skill: McpSkill): SkillHttpUrls | null {
  if (!skill.uri.startsWith(SKILL_URI_PREFIX) || !skill.uri.endsWith("/SKILL.md")) return null;
  const name = skill.uri.slice(SKILL_URI_PREFIX.length, -"/SKILL.md".length);
  if (!name || name.includes("/")) return null;
  const base = `${origin}/skills/${name}`;
  const prefix = `${SKILL_URI_PREFIX}${name}/`;
  const files = skill.resources === "dynamic"
    ? []
    : skill.resources
      .filter((r) => r.uri.startsWith(prefix))
      .map((r) => {
        const path = r.uri.slice(prefix.length);
        return { path, size: r.size, url: `${base}/${path}` };
      });
  return { name, skillMd: `${base}/SKILL.md`, zip: `${base}.zip`, files };
}
