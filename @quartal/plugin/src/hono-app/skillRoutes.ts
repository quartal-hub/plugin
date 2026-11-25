import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Context, Hono } from "hono";

import type { PluginFileMapEntry } from "../model/index.ts";
import { fileMapBytes, fileMapGet, fileMapUnder } from "../helpers/fileMap.ts";
import { isValidSkillName } from "./skillDiscovery.ts";
import { buildDirectoryZip, buildFilesZip } from "./skillZip.ts";

function skillsRoot(baseDir: string): string {
  return join(baseDir, "skills");
}

function skillDir(baseDir: string, name: string): string {
  return join(skillsRoot(baseDir), name);
}

/** Resolves a relative path inside a skill directory; returns null if unsafe. */
function resolveSkillFilePath(baseDir: string, name: string, relativePath: string): string | null {
  if (!isValidSkillName(name)) return null;
  const rel = relativePath.replaceAll("\\", "/");
  if (!rel || rel.includes("..") || rel.startsWith("/")) return null;

  const root = resolve(skillDir(baseDir, name));
  const target = resolve(root, rel);
  const rootWithSep = root.endsWith("/") || root.endsWith("\\") ? root : root + "/";
  if (target !== root && !target.startsWith(rootWithSep) && !target.startsWith(root + "\\")) {
    return null;
  }
  return target;
}

async function buildSkillZip(baseDir: string, name: string): Promise<Uint8Array | null> {
  const root = skillDir(baseDir, name);
  try {
    const st = await stat(join(root, "SKILL.md"));
    if (!st.isFile()) return null;
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw e;
  }
  return await buildDirectoryZip(root);
}

/** Zips one skill from the file map (paths relative to the skill directory), or null when absent. */
function buildSkillZipFromMap(files: readonly PluginFileMapEntry[], name: string): Uint8Array | null {
  const prefix = `skills/${name}/`;
  if (!fileMapGet(files, `${prefix}SKILL.md`)) return null;
  const entries = fileMapUnder(files, "skills")
    .filter((f) => f.path.startsWith(prefix))
    .map((f) => ({ path: f.path.slice(prefix.length), data: fileMapBytes(f) }));
  return buildFilesZip(entries);
}

function zipHeaders(filename: string): Record<string, string> {
  return {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${filename}.zip"`,
  };
}

/** Options for {@link registerSkillRoutes}. */
export interface SkillRoutesOptions {
  /** Build-time file map; when present, skills are served from it instead of disk. */
  fileMap?: readonly PluginFileMapEntry[];
}

function skillFileContentType(subPath: string): string {
  const dot = subPath.lastIndexOf(".");
  const ext = dot === -1 ? "" : subPath.slice(dot).toLowerCase();
  const textTypes = [".md", ".txt", ".json", ".ts", ".js", ".yaml", ".yml", ".csv", ".xml", ".html", ".css", ".sh", ".ps1", ".py"];
  return textTypes.includes(ext)
    ? `${ext === ".md" ? "text/markdown" : "text/plain"}; charset=utf-8`
    : "application/octet-stream";
}

/**
 * Serves Agent Skills over plain HTTP: each skill's files and a zip download per skill. The skill
 * list itself is the MCP `skills/list` result (`GET /mcp/skills.json`, see `PluginMcpHelper`).
 * With a file map (bundled deployments) everything is served from memory; otherwise from
 * `<root>/skills/` on disk.
 * @param app Hono app to register routes on.
 * @param pluginRootFolder Plugin root (defaults to cwd).
 * @param options File map injection.
 */
export function registerSkillRoutes(
  app: Hono,
  pluginRootFolder?: string,
  options?: SkillRoutesOptions,
): void {
  const baseDir = pluginRootFolder ?? process.cwd();
  const fileMap = options?.fileMap;

  const serveSkillArchive = async (c: Context, name: string): Promise<Response> => {
    if (!isValidSkillName(name)) return c.text("Not found", 404);
    const bytes = fileMap ? buildSkillZipFromMap(fileMap, name) : await buildSkillZip(baseDir, name);
    if (!bytes) return c.text("Not found", 404);
    return c.body(new Uint8Array(bytes), 200, zipHeaders(name));
  };

  const readSkillFile = async (name: string, subPath: string): Promise<Uint8Array | null> => {
    if (fileMap) {
      if (!isValidSkillName(name)) return null;
      const entry = fileMapGet(fileMap, `skills/${name}/${subPath}`);
      return entry ? fileMapBytes(entry) : null;
    }
    const filePath = resolveSkillFilePath(baseDir, name, subPath);
    if (!filePath) return null;
    try {
      const st = await stat(filePath);
      if (!st.isFile()) return null;
      return new Uint8Array(await readFile(filePath));
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return null;
      throw e;
    }
  };

  app.get("/skills/:archive{.+\\.zip$}", (c) => {
    const name = (c.req.param("archive") ?? "").replace(/\.zip$/, "");
    return serveSkillArchive(c, name);
  });

  app.get("/skills/:name/SKILL.md", async (c) => {
    const bytes = await readSkillFile(c.req.param("name"), "SKILL.md");
    if (!bytes) return c.text("Not found", 404);
    return c.body(new Uint8Array(bytes), 200, { "Content-Type": "text/markdown; charset=utf-8" });
  });

  app.get("/skills/:name/*", async (c) => {
    const name = c.req.param("name");
    const subPath = c.req.path.replace(`/skills/${name}/`, "");
    if (!subPath || subPath === "SKILL.md") return c.text("Not found", 404);
    // The same traversal rules apply to map lookups: reject before the exact-path match.
    if (subPath.includes("..") || subPath.startsWith("/")) return c.text("Not found", 404);

    const bytes = await readSkillFile(name, subPath);
    if (!bytes) return c.text("Not found", 404);
    return c.body(new Uint8Array(bytes), 200, { "Content-Type": skillFileContentType(subPath) });
  });
}
