import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { fail, warn } from "./log.mjs";

/** Directory (relative to the repo root) holding the deployable sample plugins. */
export const SAMPLES_DIR = "samples";

/** Astro config file names, in the order Astro itself resolves them. */
const ASTRO_CONFIG_NAMES = ["astro.config.mjs", "astro.config.js", "astro.config.ts", "astro.config.mts"];

/** Reads and parses a JSON file.
 * @param path File path.
 */
export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

/** Names of every sample plugin that looks deployable (has a `package.json` + an Astro config).
 * @param repoRoot Absolute path of the repository root.
 */
export function listProjects(repoRoot) {
  const base = join(repoRoot, SAMPLES_DIR);
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => existsSync(join(base, name, "package.json")))
    .filter((name) => ASTRO_CONFIG_NAMES.some((cfg) => existsSync(join(base, name, cfg))))
    .sort();
}

/**
 * Loads `qrtl.config.*` for its `deploy` metadata. Prefers a real import (Node >= 22.18 strips the
 * TypeScript types itself) and falls back to a regex when the plugin's dependencies are not
 * installed, so `--dry-run` works on a fresh clone.
 * @param dir Plugin root directory.
 */
async function loadQrtlDeploy(dir) {
  const jsonPath = join(dir, "qrtl.config.json");
  if (existsSync(jsonPath)) return readJson(jsonPath).deploy ?? {};

  for (const ext of ["ts", "mts", "mjs", "js"]) {
    const path = join(dir, `qrtl.config.${ext}`);
    if (!existsSync(path)) continue;
    try {
      const mod = await import(pathToFileURL(path).href);
      return (mod.default ?? mod.config)?.deploy ?? {};
    } catch {
      const source = readFileSync(path, "utf-8");
      const block = /deploy\s*:\s*\{([^}]*)\}/.exec(source)?.[1] ?? "";
      const pick = (key) => new RegExp(`${key}\\s*:\\s*["'\`]([^"'\`]+)`).exec(block)?.[1];
      const deploy = { org: pick("org"), app: pick("app") };
      if (!deploy.org && !deploy.app) {
        warn(`Could not read deploy metadata from ${path}; pass --org/--app explicitly.`);
      }
      return deploy;
    }
  }
  return {};
}

/**
 * Resolves a sample plugin by directory name into everything the deployment pipeline needs.
 * @param repoRoot Absolute path of the repository root.
 * @param name Directory name under `samples/` (e.g. `test1`).
 */
export async function loadProject(repoRoot, name) {
  const dir = join(repoRoot, SAMPLES_DIR, name);
  if (!existsSync(dir)) {
    const known = listProjects(repoRoot).join(", ");
    fail(`Unknown project "${name}". Available: ${known || "(none)"}.`);
  }

  const astroConfig = ASTRO_CONFIG_NAMES.find((cfg) => existsSync(join(dir, cfg)));
  if (!astroConfig) fail(`${SAMPLES_DIR}/${name} has no Astro config — it is not a deployable plugin.`);

  const pkg = readJson(join(dir, "package.json"));
  const deploy = await loadQrtlDeploy(dir);

  return { name, dir, pkg, astroConfig, org: deploy.org, app: deploy.app ?? name };
}
