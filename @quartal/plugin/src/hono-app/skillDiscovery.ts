import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { SkillEntry, SkillFileEntry, SkillFrontmatter, SkillsCatalog } from "@quartal/plugin-core";
import { Helpers } from "../helpers/Helpers.ts";
import { parseFrontmatter } from "../helpers/parseFrontmatter.ts";

const SKILL_NAME_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const MIME_BY_EXT: Record<string, string> = {
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".json": "application/json",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".ts": "text/typescript",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".sh": "text/x-shellscript",
  ".ps1": "text/plain",
  ".py": "text/x-python",
  ".csv": "text/csv",
  ".xml": "application/xml",
  ".html": "text/html",
  ".css": "text/css",
};

/** Validates an Agent Skills `name` (https://agentskills.io/specification). */
export function isValidSkillName(name: string): boolean {
  if (name.length < 1 || name.length > 64) return false;
  if (name.startsWith("-") || name.endsWith("-") || name.includes("--")) return false;
  return SKILL_NAME_RE.test(name);
}

function guessMimeType(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  return MIME_BY_EXT[path.slice(dot).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Parses the YAML frontmatter of a `SKILL.md`.
 *
 * Shares {@link parseFrontmatter} with agent files, so both primitives read the same dialect:
 * real YAML, including the nested `metadata` map that the Agent Skills spec allows.
 * @param content SKILL.md contents.
 * @returns The skill metadata, or null when there is no frontmatter or it lacks name/description.
 * @throws {Error} When the frontmatter is present but not valid YAML.
 */
export function parseSkillFrontmatter(content: string): SkillFrontmatter | null {
  const parsed = parseFrontmatter(content);
  if (!parsed) return null;

  const { fields } = parsed;
  const name = asString(fields.name);
  const description = asString(fields.description);
  if (!name || !description) return null;

  const license = asString(fields.license);
  const compatibility = asString(fields.compatibility);
  const metadata = asRecord(fields.metadata);

  return {
    name,
    description,
    ...(license ? { license } : {}),
    ...(compatibility ? { compatibility } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

/** Recursively yields absolute file paths under `dir` (files only). */
async function* walkFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function listSkillFiles(skillDir: string): Promise<SkillFileEntry[]> {
  const files: SkillFileEntry[] = [];
  for await (const path of walkFiles(skillDir)) {
    const rel = relative(skillDir, path).replaceAll("\\", "/");
    if (rel.startsWith(".") || rel.includes("/.")) continue;
    const info = await stat(path);
    files.push({
      path: rel,
      size: info.size,
      mimeType: guessMimeType(rel),
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

/**
 * Discovers Agent Skills in `<baseDir>/skills/{name}/SKILL.md`.
 * Invalid or incomplete skills are skipped with a console warning.
 * @param baseDir Plugin root directory.
 * @param pluginName Plugin name (for the skills catalog manifest).
 */
export async function discoverSkills(baseDir: string, pluginName: string): Promise<SkillsCatalog> {
  const skillsRoot = join(baseDir, "skills");
  const skills: SkillEntry[] = [];

  let skillDirs: string[] = [];
  try {
    const entries = await readdir(skillsRoot, { withFileTypes: true });
    skillDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
      return { version: "1.0", plugin: pluginName, skills: [] };
    }
    throw e;
  }

  skillDirs.sort((a, b) => a.localeCompare(b));

  for (const dirName of skillDirs) {
    const skillDir = join(skillsRoot, dirName);
    const skillMdPath = join(skillDir, "SKILL.md");
    const raw = await Helpers.readIfExists(skillMdPath);
    if (!raw) continue;

    let fm: SkillFrontmatter | null;
    try {
      fm = parseSkillFrontmatter(raw);
    } catch (e) {
      // A YAML error carries the offending line and column — pass it through verbatim.
      console.warn(`[skillDiscovery] ${dirName}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (!fm) {
      console.warn(`[skillDiscovery] ${dirName}: missing or invalid SKILL.md frontmatter`);
      continue;
    }
    if (!isValidSkillName(fm.name)) {
      console.warn(`[skillDiscovery] ${dirName}: invalid skill name "${fm.name}"`);
      continue;
    }
    if (fm.name !== dirName) {
      console.warn(`[skillDiscovery] ${dirName}: folder name does not match frontmatter name "${fm.name}"`);
      continue;
    }

    const files = await listSkillFiles(skillDir);
    skills.push({
      name: fm.name,
      description: fm.description,
      ...(fm.license ? { license: fm.license } : {}),
      ...(fm.compatibility ? { compatibility: fm.compatibility } : {}),
      ...(fm.metadata ? { metadata: fm.metadata } : {}),
      files,
    });
  }

  return { version: "1.0", plugin: pluginName, skills };
}
