import { Buffer } from "node:buffer";
import type { PluginFileMapEntry } from "../model/index.ts";

/**
 * Runtime accessors for the build-time file map (see {@link PluginFileMapEntry}). Kept free of
 * filesystem imports: this module runs wherever the app runs, including Workers.
 */

/** The file's contents as bytes.
 * @param entry File map entry.
 */
export function fileMapBytes(entry: PluginFileMapEntry): Uint8Array {
  if (entry.text !== undefined) return new TextEncoder().encode(entry.text);
  return new Uint8Array(Buffer.from(entry.base64 ?? "", "base64"));
}

/** The file's contents as UTF-8 text.
 * @param entry File map entry.
 */
export function fileMapText(entry: PluginFileMapEntry): string {
  if (entry.text !== undefined) return entry.text;
  return Buffer.from(entry.base64 ?? "", "base64").toString("utf-8");
}

/** The file's size in bytes (as served / as zipped).
 * @param entry File map entry.
 */
export function fileMapSize(entry: PluginFileMapEntry): number {
  if (entry.text !== undefined) return new TextEncoder().encode(entry.text).length;
  return Buffer.from(entry.base64 ?? "", "base64").length;
}

/** Entries under `dir` (e.g. `"skills"`), with `path` still plugin-root-relative.
 * @param files The file map.
 * @param dir Top-level directory name, no slashes.
 */
export function fileMapUnder(files: readonly PluginFileMapEntry[], dir: string): PluginFileMapEntry[] {
  const prefix = `${dir}/`;
  return files.filter((f) => f.path.startsWith(prefix));
}

/** The entry at exactly `path`, or undefined.
 * @param files The file map.
 * @param path Plugin-root-relative path with forward slashes.
 */
export function fileMapGet(files: readonly PluginFileMapEntry[], path: string): PluginFileMapEntry | undefined {
  return files.find((f) => f.path === path);
}
