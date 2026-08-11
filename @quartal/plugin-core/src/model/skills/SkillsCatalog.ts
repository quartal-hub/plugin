/** A file inside a skill directory (paths relative to the skill root). */
export interface SkillFileEntry {
  /** Path relative to the skill root (e.g. `SKILL.md`, `scripts/run.ts`). */
  path: string;
  /** File size in bytes. */
  size: number;
  /** MIME type used when serving the file. */
  mimeType: string;
}

/** Parsed Agent Skill metadata from SKILL.md frontmatter. */
export interface SkillFrontmatter {
  /** Skill identifier (directory name under `skills/`). */
  name: string;
  /** Short description shown in catalog listings. */
  description: string;
  /** SPDX license identifier or license text. */
  license?: string;
  /** Runtime or environment compatibility notes. */
  compatibility?: string;
  /** Arbitrary key/value metadata from frontmatter. */
  metadata?: Record<string, unknown>;
}

/** One skill discovered under `<plugin>/skills/<name>/`. */
export interface SkillEntry {
  /** Skill identifier (directory name under `skills/`). */
  name: string;
  /** Short description shown in catalog listings. */
  description: string;
  /** SPDX license identifier or license text. */
  license?: string;
  /** Runtime or environment compatibility notes. */
  compatibility?: string;
  /** Arbitrary key/value metadata from frontmatter. */
  metadata?: Record<string, unknown>;
  /** Files bundled with the skill. */
  files: SkillFileEntry[];
}

/** Manifest served at `/skills/catalog.json` before URL enrichment. */
export interface SkillsCatalog {
  /** Catalog schema version. */
  version: "1.0";
  /** Plugin name (e.g. `@samples/my-plugin`). */
  plugin: string;
  /** Skills exposed by this plugin. */
  skills: SkillEntry[];
}

/** Absolute URLs for a skill entry, added at serve time. */
export interface SkillCatalogUrls {
  /** URL to `SKILL.md`. */
  skillMd: string;
  /** URL to download the skill as a zip archive. */
  zip: string;
  /** URL to the skill directory root. */
  skill: string;
  /** URL to the rendered HTML documentation page. */
  html: string;
}

/** A skill file entry with an absolute fetch URL. */
export interface SkillFileWithUrl extends SkillFileEntry {
  /** Absolute URL to fetch this file. */
  url: string;
}

/** One skill entry with absolute URLs added at serve time. */
export interface SkillCatalogEntry extends SkillEntry {
  /** Absolute URLs for common skill resources. */
  urls: SkillCatalogUrls;
  /** Files bundled with the skill, each with an absolute URL. */
  files: SkillFileWithUrl[];
}

/** Response for `GET /skills/catalog.json`. */
export interface SkillsCatalogResponse {
  /** Catalog schema version. */
  version: "1.0";
  /** Plugin name (e.g. `@samples/my-plugin`). */
  plugin: string;
  /** Skills with enriched URLs. */
  skills: SkillCatalogEntry[];
}
