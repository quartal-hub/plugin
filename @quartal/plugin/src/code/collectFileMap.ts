import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import type { PluginFileMapEntry } from "../model/index.ts";

/** Extensions stored as UTF-8 text in the file map; everything else is base64. */
const TEXT_EXTENSIONS = new Set([
  ".cjs", ".css", ".csv", ".html", ".js", ".json", ".jsonc", ".md", ".mdx", ".mjs", ".ps1",
  ".py", ".sh", ".toml", ".ts", ".tsx", ".txt", ".xml", ".yaml", ".yml",
]);

/** Files above this size are still inlined, but codegen warns — they grow every server bundle. */
const LARGE_FILE_BYTES = 1024 * 1024;

function isTextPath(path: string): boolean {
  const dot = path.lastIndexOf(".");
  return dot !== -1 && TEXT_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

/** Recursively yields absolute file paths under `dir` (files only). */
async function* walkFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkFiles(full);
    else if (entry.isFile()) yield full;
  }
}

/**
 * Collects the plugin's `skills/` and `agents/` trees into the build-time file map that codegen
 * inlines into the artifacts module (dotfiles skipped, deterministic order). Text files are stored
 * as UTF-8 strings, others base64. Missing directories contribute nothing — the map is emitted
 * even when empty, so the runtime knows "no skills" from the build rather than probing disk.
 * @param cwd Plugin root directory.
 * @param dirs Top-level directories to capture. Default `["skills", "agents"]`.
 * @param onWarning Sink for large-file warnings. Defaults to `console.warn`.
 */
export async function collectPluginFileMap(
  cwd: string,
  dirs: readonly string[] = ["skills", "agents"],
  onWarning: (message: string) => void = (m) => console.warn(`[qrtl-plugin-codegen] ${m}`),
): Promise<PluginFileMapEntry[]> {
  const entries: PluginFileMapEntry[] = [];
  for (const dir of dirs) {
    const root = join(cwd, dir);
    let paths: string[] = [];
    try {
      for await (const path of walkFiles(root)) paths.push(path);
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT") continue;
      throw e;
    }
    paths.sort((a, b) => a.localeCompare(b));
    for (const path of paths) {
      const rel = relative(root, path).replaceAll("\\", "/");
      if (rel.startsWith(".") || rel.includes("/.")) continue;
      const bytes = await readFile(path);
      const mapPath = `${dir}/${rel}`;
      if (bytes.length > LARGE_FILE_BYTES) {
        onWarning(`${mapPath} is ${(bytes.length / 1024 / 1024).toFixed(1)} MB — it is inlined into every server bundle.`);
      }
      entries.push(
        isTextPath(rel)
          ? { path: mapPath, text: bytes.toString("utf-8") }
          : { path: mapPath, base64: bytes.toString("base64") },
      );
    }
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}
