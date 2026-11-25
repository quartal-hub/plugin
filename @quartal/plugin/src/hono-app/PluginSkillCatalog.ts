import { stat } from "node:fs/promises";
import { join } from "node:path";
import { SkillCatalog, memorySkillFiles, type SkillFiles, type SkillWarning } from "@modelcontextprotocol/server/ext/skills";
import { nodeSkillFiles } from "@modelcontextprotocol/server/ext/skills/node";

import type { ListSkillsResult, PluginFileMapEntry } from "../model/index.ts";
import { fileMapBytes, fileMapUnder } from "../helpers/fileMap.ts";

/** How long clients may cache skills of a deployed plugin (`ttlMs` on 2026-07-28 results). */
const DEPLOYED_TTL_MS = 5 * 60_000;
/** Minimum time between two rescans of `skills/` on disk (dev), so a burst of requests scans once. */
const DISK_RESCAN_MS = 1_000;

/**
 * The plugin's Agent Skills as an MCP Skills extension (`io.modelcontextprotocol/skills`) catalog:
 * `skills/list`, `skills/get` and `skill://<name>/<path>` resources, built by the SDK's
 * `SkillCatalog` from the `skills/` folder. The catalog validates every skill (frontmatter, name =
 * folder, size limits) and publishes a digest manifest per skill.
 *
 * With a build-time file map the catalog is built once; from disk (dev) it is rescanned at most
 * once a second, so edited skills show up without a restart.
 */
export class PluginSkillCatalog {
  private catalog: Promise<SkillCatalog | undefined> | undefined;
  private lastScan = 0;

  /**
   * @param baseDir Plugin root; skills are read from `<baseDir>/skills/` when there is no file map.
   * @param fileMap Build-time file map; when present, skills are served from it.
   */
  constructor(
    private readonly baseDir: string,
    private readonly fileMap?: readonly PluginFileMapEntry[],
  ) {}

  /** The catalog, or `undefined` when the plugin has no `skills/` folder. */
  async get(): Promise<SkillCatalog | undefined> {
    if (!this.catalog) {
      this.lastScan = Date.now();
      this.catalog = this.load();
      return this.catalog;
    }
    const catalog = await this.catalog;
    if (catalog && !this.fileMap && Date.now() - this.lastScan > DISK_RESCAN_MS) {
      this.lastScan = Date.now();
      await catalog.reload();
    }
    return catalog;
  }

  /** The `skills/list` result with every skill (no pagination) — the body of `GET /mcp/skills.json`. */
  async listResult(): Promise<ListSkillsResult> {
    const catalog = await this.get();
    return { skills: [...(catalog?.entries ?? [])] };
  }

  private async load(): Promise<SkillCatalog | undefined> {
    const files = await this.skillFiles();
    if (!files) return undefined;
    return SkillCatalog.load(files, {
      cacheHint: this.fileMap
        ? { ttlMs: DEPLOYED_TTL_MS, cacheScope: "public" }
        : { ttlMs: 0, cacheScope: "public" },
      onWarning: (warning: SkillWarning) => console.warn(`[skills] ${warning.path}: ${warning.message}`),
    });
  }

  private async skillFiles(): Promise<SkillFiles | undefined> {
    if (this.fileMap) {
      const entries = fileMapUnder(this.fileMap, "skills");
      if (entries.length === 0) return undefined;
      const record: Record<string, Uint8Array> = {};
      for (const entry of entries) record[entry.path.slice("skills/".length)] = fileMapBytes(entry);
      return memorySkillFiles(record);
    }
    const root = join(this.baseDir, "skills");
    try {
      if (!(await stat(root)).isDirectory()) return undefined;
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return undefined;
      throw e;
    }
    return nodeSkillFiles(root);
  }
}
