import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fail, info } from "./log.mjs";
import { readJson } from "./project.mjs";
import { run } from "./run.mjs";

/** Directory names (relative to the repo root) that hold workspace packages. */
const WORKSPACE_DIRS = ["@quartal", "samples"];

/** Dependency fields rewritten when a plugin is staged. */
const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

/** Directory inside the stage that holds copies of unpublished workspace packages. */
export const VENDOR_DIR = "vendor";

/** Builds a `name -> { dir, pkg }` index of every package in the pnpm workspace.
 * @param repoRoot Absolute path of the repository root.
 */
export function indexWorkspacePackages(repoRoot) {
  const index = new Map();
  for (const group of WORKSPACE_DIRS) {
    const base = join(repoRoot, group);
    if (!existsSync(base)) continue;
    for (const entry of subdirectories(base)) {
      const manifest = join(base, entry, "package.json");
      if (!existsSync(manifest)) continue;
      const pkg = readJson(manifest);
      if (pkg.name) index.set(pkg.name, { dir: join(base, entry), pkg });
    }
  }
  return index;
}

function subdirectories(dir) {
  return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
}

/** Converts a `workspace:` specifier into a registry range using the workspace package's version.
 * @param spec The original `workspace:...` specifier.
 * @param version Version of the workspace package being referenced.
 */
function toRegistryRange(spec, version) {
  const rest = spec.slice("workspace:".length);
  if (rest === "" || rest === "*" || rest === "^") return `^${version}`;
  if (rest === "~") return `~${version}`;
  return rest;
}

/**
 * Packs a workspace package into a tarball under the stage's `vendor/` folder, keeping only what
 * npm needs to install it (`package.json` + whatever the package's `files` field publishes).
 *
 * Tarballs, not directories: npm installs a `file:` *directory* as a symlink in `node_modules`,
 * which breaks module tracers that recreate symlinks (Vercel's nft — dangling links inside the
 * function bundle, EPERM on Windows). A `file:` *tarball* installs as a real copy everywhere.
 *
 * Nested `workspace:` dependencies are packed recursively but referenced by their registry range:
 * a relative `file:` path inside a tarball would not survive extraction, so instead every packed
 * package is also added to the stage's own dependencies (see {@link resolveWorkspaceDeps}), and its
 * version satisfies the nested range.
 * @param name Package name to vendor.
 * @param context `{ index, stageDir, vendored }` shared across the recursion.
 */
function vendorPackage(name, context) {
  const { index, stageDir, vendored } = context;
  if (vendored.has(name)) return vendored.get(name);

  const source = index.get(name);
  if (!source) fail(`Workspace package "${name}" was not found in ${WORKSPACE_DIRS.map((d) => `${d}/`).join(" or ")}.`);

  const folder = name.replace(/^@/, "").replace(/\//g, "-");
  const tarball = `${folder}-${source.pkg.version}.tgz`;
  vendored.set(name, tarball);

  const vendorDir = join(stageDir, VENDOR_DIR);
  const dest = join(vendorDir, folder);
  mkdirSync(dest, { recursive: true });

  const published = new Set([...(source.pkg.files ?? ["dist"]), "package.json", "README.md", "LICENSE"]);
  for (const entry of published) {
    const from = join(source.dir, entry);
    if (existsSync(from)) cpSync(from, join(dest, entry), { recursive: true });
  }
  if (!existsSync(join(dest, "dist"))) {
    fail(`${name} has no dist/ — run \`pnpm run build:libs\` before staging with --link local.`);
  }

  // Strip lifecycle scripts and dev-only metadata: the copy is installed, never built.
  const manifest = { ...source.pkg };
  delete manifest.scripts;
  delete manifest.devDependencies;
  for (const field of DEP_FIELDS) {
    const deps = manifest[field];
    if (!deps) continue;
    manifest[field] = Object.fromEntries(
      Object.entries(deps).map(([dep, spec]) => {
        if (!String(spec).startsWith("workspace:")) return [dep, spec];
        const nested = index.get(dep);
        vendorPackage(dep, context);
        return [dep, toRegistryRange(spec, nested.pkg.version)];
      }),
    );
  }
  writeFileSync(join(dest, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  run("npm", ["pack", "--silent", "--pack-destination", ".."], { cwd: dest });
  rmSync(dest, { recursive: true, force: true });
  info(`vendored ${name} -> ${VENDOR_DIR}/${tarball}`);
  return tarball;
}

/**
 * Rewrites every `workspace:` specifier in a staged manifest so plain `npm install` can resolve it.
 *
 * - `registry` (default) points at the published `@quartal/*` packages on npm.
 * - `local` copies the built workspace packages into the stage, which is what you want before a
 *   release or when validating an unpublished change end to end.
 * @param options `{ pkg, repoRoot, stageDir, linkMode }`.
 */
export function resolveWorkspaceDeps({ pkg, repoRoot, stageDir, linkMode }) {
  const index = indexWorkspacePackages(repoRoot);
  const context = { index, stageDir, vendored: new Map() };

  for (const field of DEP_FIELDS) {
    const deps = pkg[field];
    if (!deps) continue;
    for (const [dep, spec] of Object.entries(deps)) {
      if (!String(spec).startsWith("workspace:")) continue;
      const source = index.get(dep);
      if (!source) fail(`${pkg.name} depends on workspace package "${dep}", which is not in this repo.`);
      if (linkMode === "local") {
        deps[dep] = `file:./${VENDOR_DIR}/${vendorPackage(dep, context)}`;
      } else {
        deps[dep] = toRegistryRange(spec, source.pkg.version);
        info(`${dep} ${spec} -> ${deps[dep]}`);
      }
    }
  }

  // Transitively packed packages (e.g. plugin-core behind plugin) must install from their tarballs
  // too: their ranges inside other tarballs resolve against what the stage itself installs.
  for (const [name, tarball] of context.vendored) {
    pkg.dependencies ??= {};
    pkg.dependencies[name] = `file:./${VENDOR_DIR}/${tarball}`;
  }
  return { vendored: [...context.vendored.keys()] };
}
