import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import type { PluginFileMapEntry } from "../model/index.ts";
import { QUARTAL_EXTENSION_NAMESPACE } from "../model/index.ts";
import { resolveUnderRoot } from "../hono-app/staticFileUtils.ts";

/**
 * Extension directories: a folder at the plugin root named after a reverse-domain namespace
 * (`com.example.product/`) holds content for one Agent Plugins extension. The plugin serves it at
 * the same path, packages it into `plugin.zip` and lists it under `extensions[<namespace>]` in
 * `plugin.json`, so a host that knows the extension finds its files and every other client
 * ignores them. `com.quartal.plugin` is reserved for the generated overview.
 */

/** A reverse-domain namespace: at least two dot-separated lowercase labels. */
const NAMESPACE_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/;

/** The `extensions[<namespace>]` block of `plugin.json` for an extension directory. */
export interface ExtensionDirectoryBlock {
  /** Absolute path of the directory on the plugin's origin, with a trailing slash. */
  path: string;
  /** The directory's files, relative to it, sorted. */
  files: string[];
}

/**
 * Whether `name` names an extension directory (a reverse-domain namespace other than the
 * reserved `com.quartal.plugin`).
 * @param name A top-level folder name.
 */
export function isExtensionNamespace(name: string): boolean {
  return NAMESPACE_PATTERN.test(name) && name !== QUARTAL_EXTENSION_NAMESPACE;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function walk(dir: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await walk(join(dir, entry.name), rel)));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

/**
 * The extension directories at the plugin root, sorted.
 * @param pluginRootFolder Plugin root.
 */
export async function discoverExtensionDirectories(pluginRootFolder: string): Promise<string[]> {
  let names: string[];
  try {
    names = (await readdir(pluginRootFolder, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && isExtensionNamespace(e.name))
      .map((e) => e.name);
  } catch {
    return [];
  }
  return names.sort((a, b) => a.localeCompare(b));
}

/**
 * The extension directories and their files, read from disk or from the build-time file map.
 * @param pluginRootFolder Plugin root (used without a file map).
 * @param fileMap Build-time file map; authoritative when given.
 */
export async function listExtensionDirectories(
  pluginRootFolder: string,
  fileMap?: readonly PluginFileMapEntry[],
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  if (fileMap) {
    for (const entry of fileMap) {
      const slash = entry.path.indexOf("/");
      if (slash < 0) continue;
      const ns = entry.path.slice(0, slash);
      if (!isExtensionNamespace(ns)) continue;
      (result[ns] ??= []).push(entry.path.slice(slash + 1));
    }
  } else {
    for (const ns of await discoverExtensionDirectories(pluginRootFolder)) {
      const dir = join(pluginRootFolder, ns);
      if (await isDirectory(dir)) result[ns] = await walk(dir);
    }
  }
  for (const files of Object.values(result)) files.sort((a, b) => a.localeCompare(b));
  return result;
}

/**
 * The `extensions` entries of `plugin.json` for the extension directories.
 * @param dirs Extension directories and their files (see {@link listExtensionDirectories}).
 */
export function extensionDirectoryBlocks(dirs: Record<string, string[]>): Record<string, ExtensionDirectoryBlock> {
  return Object.fromEntries(Object.entries(dirs).map(([ns, files]) => [ns, { path: `/${ns}/`, files }]));
}

/**
 * Reads one file of an extension directory, or undefined when there is none.
 * @param pluginRootFolder Plugin root (used without a file map).
 * @param namespace The extension directory.
 * @param relativePath Path inside the directory.
 * @param fileMap Build-time file map; authoritative when given.
 */
export async function readExtensionFile(
  pluginRootFolder: string,
  namespace: string,
  relativePath: string,
  fileMap?: readonly PluginFileMapEntry[],
): Promise<PluginFileMapEntry | undefined> {
  if (!isExtensionNamespace(namespace)) return undefined;
  const path = `${namespace}/${relativePath}`;
  if (fileMap) return fileMap.find((f) => f.path === path);
  const file = resolveUnderRoot(join(pluginRootFolder, namespace), relativePath);
  if (!file) return undefined;
  try {
    if (!(await stat(file)).isFile()) return undefined;
    return { path, base64: (await readFile(file)).toString("base64") };
  } catch {
    return undefined;
  }
}
