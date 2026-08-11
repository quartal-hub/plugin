import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Context, Hono } from "hono";

import type { PluginManifest, SkillsCatalog, SkillsCatalogResponse } from "../model/index.ts";
import { discoverSkills, isValidSkillName } from "./skillDiscovery.ts";
import { buildDirectoryZip } from "./skillZip.ts";
import { Helpers } from "../helpers/Helpers.ts";

function enrichCatalog(catalog: SkillsCatalog, origin: string): SkillsCatalogResponse {
  return {
    version: catalog.version,
    plugin: catalog.plugin,
    skills: catalog.skills.map((skill) => ({
      ...skill,
      urls: {
        skillMd: `${origin}/skills/${skill.name}/SKILL.md`,
        zip: `${origin}/skills/${skill.name}.zip`,
        skill: `${origin}/skills/${skill.name}.skill`,
        html: `${origin}/skills.html?skill=${encodeURIComponent(skill.name)}`,
      },
      files: skill.files.map((f) => ({
        ...f,
        url: `${origin}/skills/${skill.name}/${f.path}`,
      })),
    })),
  };
}

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

async function loadCatalog(baseDir: string, manifest: PluginManifest): Promise<SkillsCatalog> {
  return await discoverSkills(baseDir, manifest.name);
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

function zipHeaders(filename: string, extension: "zip" | "skill"): Record<string, string> {
  const type = extension === "skill" ? "skill" : "zip";
  return {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${filename}.${type}"`,
  };
}

async function serveSkillArchive(
  c: Context,
  baseDir: string,
  name: string,
  extension: "zip" | "skill",
): Promise<Response> {
  if (!isValidSkillName(name)) return c.text("Not found", 404);

  const bytes = await buildSkillZip(baseDir, name);
  if (!bytes) return c.text("Not found", 404);
  return c.body(new Uint8Array(bytes), 200, zipHeaders(name, extension));
}

/**
 * Serves Agent Skills: catalog, static files, and zip/.skill downloads.
 * @param app Hono app to register routes on.
 * @param pluginRootFolder Plugin root (defaults to cwd).
 * @param manifest Plugin manifest (loaded on demand if omitted).
 */
export function registerSkillRoutes(app: Hono, pluginRootFolder?: string, manifest?: PluginManifest): void {
  const baseDir = pluginRootFolder ?? process.cwd();
  const pkg = manifest;

  app.get("/skills/catalog.json", async (c) => {
    const info = pkg ?? await Helpers.getPluginManifest(baseDir);
    const catalog = await loadCatalog(baseDir, info);
    const origin = new URL(c.req.url).origin;
    return c.json(enrichCatalog(catalog, origin));
  });

  app.get("/skills/:archive{.+\\.zip$}", (c) => {
    const name = (c.req.param("archive") ?? "").replace(/\.zip$/, "");
    return serveSkillArchive(c, baseDir, name, "zip");
  });
  app.get("/skills/:archive{.+\\.skill$}", (c) => {
    const name = (c.req.param("archive") ?? "").replace(/\.skill$/, "");
    return serveSkillArchive(c, baseDir, name, "skill");
  });

  app.get("/skills/:name/SKILL.md", async (c) => {
    const name = c.req.param("name");
    const filePath = resolveSkillFilePath(baseDir, name, "SKILL.md");
    if (!filePath) return c.text("Not found", 404);
    try {
      const content = await readFile(filePath, "utf-8");
      return c.body(content, 200, { "Content-Type": "text/markdown; charset=utf-8" });
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return c.text("Not found", 404);
      throw e;
    }
  });

  app.get("/skills/:name/*", async (c) => {
    const name = c.req.param("name");
    const subPath = c.req.path.replace(`/skills/${name}/`, "");
    if (!subPath || subPath === "SKILL.md") return c.text("Not found", 404);

    const filePath = resolveSkillFilePath(baseDir, name, subPath);
    if (!filePath) return c.text("Not found", 404);

    try {
      const st = await stat(filePath);
      if (!st.isFile()) return c.text("Not found", 404);
      const bytes = new Uint8Array(await readFile(filePath));
      const dot = subPath.lastIndexOf(".");
      const ext = dot === -1 ? "" : subPath.slice(dot).toLowerCase();
      const textTypes = [".md", ".txt", ".json", ".ts", ".js", ".yaml", ".yml", ".csv", ".xml", ".html", ".css", ".sh", ".ps1", ".py"];
      const contentType = textTypes.includes(ext)
        ? `${ext === ".md" ? "text/markdown" : "text/plain"}; charset=utf-8`
        : "application/octet-stream";
      return c.body(bytes, 200, { "Content-Type": contentType });
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return c.text("Not found", 404);
      throw e;
    }
  });
}
