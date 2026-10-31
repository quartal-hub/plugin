import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { PluginGenerator } from "../model/index.ts";

let cached: PluginGenerator | null | undefined;

/**
 * The name and version of this `@quartal/plugin` package, read from its `package.json` (two levels
 * up from both `src/helpers/` and `dist/helpers/`). Codegen records it in `contents.json`;
 * `undefined` where the file is not on disk (a bundled deployment).
 */
export function pluginGenerator(): PluginGenerator | undefined {
  if (cached === undefined) {
    try {
      const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf-8")) as {
        name?: string;
        version?: string;
      };
      cached = pkg.name === "@quartal/plugin" && pkg.version ? { name: pkg.name, version: pkg.version } : null;
    } catch {
      cached = null;
    }
  }
  return cached ?? undefined;
}
