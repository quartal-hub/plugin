import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { SkillEntry, SkillFileEntry, SkillFrontmatter, SkillsCatalog } from "@quartal/plugin-core";
import { Helpers } from "../helpers/Helpers.ts";

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

/** Parses YAML frontmatter between leading `---` fences. */
export function parseSkillFrontmatter(content: string): SkillFrontmatter | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yaml = match[1];
  const name = readYamlScalar(yaml, "name");
  const description = readYamlScalar(yaml, "description");
  if (!name || !description) return null;

  const license = readYamlScalar(yaml, "license");
  const compatibility = readYamlScalar(yaml, "compatibility");

  return {
    name,
    description,
    ...(license ? { license } : {}),
    ...(compatibility ? { compatibility } : {}),
  };
}

function readYamlScalar(yaml: string, key: string): string | undefined {
  const re = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const m = yaml.match(re);
  if (!m) return undefined;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
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

    const fm = parseSkillFrontmatter(raw);
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
