import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_ICON_SIZES, derivePluginTitle } from "../hono-app/pluginMetadata.ts";
import { guessIconMimeType } from "../hono-app/pluginIcon.ts";
import type { PluginAuthor, PluginManifest, PluginIcon, PluginRepository } from "../model/index.ts";
import type { QrtlConfig } from "../model/QrtlConfig.ts";

const DEFAULT_ICON_SRC = "https://cdn.quartal.com/img/logo/quartal-logo-q.png";
const DEFAULT_LOGO = "https://cdn.quartal.com/img/logo/quartal-logo-vertical.png";

/** File names tried for the plugin config, in precedence order. */
const QRTL_CONFIG_FILES = ["qrtl.config.json", "qrtl.config.ts", "qrtl.config.mjs", "qrtl.config.js"] as const;

/**
 * Small filesystem helpers used by Quartal plugins.
 */
export class Helpers {
  /**
   * Reads a text file if it exists, otherwise returns undefined.
   * @param path - The path to the file (cwd-relative).
   * @returns The content of the file if it exists, otherwise undefined.
   * Other FS errors (like missing permissions) are thrown.
   */
  static async readIfExists(path: string): Promise<string | undefined> {
    try {
      return await readFile(path, "utf-8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return undefined;
      throw e;
    }
  }

  /**
   * Resolves the plugin root for runtime file reads (manifest, `qrtl.config`, skills, agents,
   * `public/`, generated `qrtl-plugin/` artifacts). The configured value is an absolute path baked
   * in at build time; serverless platforms run the function in a different directory than the build
   * (e.g. Vercel builds in `/vercel/path0` and runs in `/var/task`), so a baked path that does not
   * exist on the running host must not win over `process.cwd()`. Precedence:
   * `QRTL_PLUGIN_ROOT` env var, then the configured folder when it exists on disk, then `process.cwd()`.
   * @param configured Plugin root folder baked in at build time (absolute), if any.
   */
  static resolvePluginRoot(configured?: string): string {
    const fromEnv = process.env.QRTL_PLUGIN_ROOT;
    if (fromEnv) return fromEnv;
    if (configured && existsSync(configured)) return configured;
    return process.cwd();
  }

  /**
   * Reads the plugin manifest: identity (name/version/description/license/repository/…) from
   * `qrtl.config`, falling back to `package.json` for every field not set there. This is the single
   * manifest reader used by the runtime and codegen.
   * @param dir Plugin root. Defaults to the current working directory.
   */
  static async getPluginManifest(dir?: string): Promise<PluginManifest> {
    const base = dir ?? process.cwd();
    const pkgRaw = await Helpers.readIfExists(join(base, "package.json"));
    const qrtl = await Helpers.loadQrtlConfig(base);
    const pkg = (pkgRaw ? JSON.parse(pkgRaw) : {}) as Record<string, unknown>;
    return Helpers.buildManifestFromNpm(pkg, qrtl);
  }

  /**
   * Finds the plugin config file in a plugin root, trying `qrtl.config.json`, then `.ts` / `.mjs` /
   * `.js`. Returns the absolute path, or `undefined` when none is present.
   * @param dir Plugin root directory.
   */
  static async findQrtlConfigPath(dir: string): Promise<string | undefined> {
    for (const file of QRTL_CONFIG_FILES) {
      const path = join(dir, file);
      if (await Helpers.readIfExists(path) !== undefined) return path;
    }
    return undefined;
  }

  /**
   * Loads `qrtl.config` from a plugin root (see {@link findQrtlConfigPath} for the file order; module
   * forms use the default or named `config` export). Returns `undefined` when no config file is
   * present — and, without `strict`, also when one exists but fails to parse or import.
   * @param dir Plugin root directory.
   * @param options `strict` makes a present-but-broken config file throw (naming the file) instead of
   * being treated as absent — pass it wherever silently dropping the config would be harmful.
   */
  static async loadQrtlConfig(dir: string, options?: { strict?: boolean }): Promise<QrtlConfig | undefined> {
    const path = await Helpers.findQrtlConfigPath(dir);
    if (!path) return undefined;
    try {
      if (path.endsWith(".json")) {
        return JSON.parse((await Helpers.readIfExists(path))!) as QrtlConfig;
      }
      // @vite-ignore — resolved at runtime from disk; not statically analyzable by Vite.
      const mod = (await import(/* @vite-ignore */ pathToFileURL(path).href)) as {
        default?: QrtlConfig;
        config?: QrtlConfig;
      };
      return mod.default ?? mod.config;
    } catch (error) {
      if (options?.strict) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Could not load ${path}: ${message}`, { cause: error });
      }
      return undefined;
    }
  }

  /** Builds a {@link PluginManifest} from a `qrtl.config`, falling back to npm `package.json` fields. */
  private static buildManifestFromNpm(pkg: Record<string, unknown>, qrtl?: QrtlConfig): PluginManifest {
    const name = qrtl?.name ?? (pkg.name as string | undefined) ?? "Unknown";
    const description = qrtl?.description ?? (pkg.description as string | undefined) ?? "No description";
    const rawStyle = { ...(qrtl?.style ?? {}) } as Record<string, unknown>;
    const manifest: PluginManifest = {
      name,
      title: qrtl?.title ?? derivePluginTitle(name, description),
      description,
      version: qrtl?.version ?? (pkg.version as string | undefined) ?? "1.0.0",
      style: {
        logo: qrtl?.style?.logo ?? DEFAULT_LOGO,
        icons: Helpers.normalizeStyleIcons(rawStyle),
      },
    };
    if (qrtl?.style?.skin) manifest.style.skin = qrtl.style.skin;
    const license = qrtl?.license ?? (pkg.license as string | undefined) ?? undefined;
    if (license) manifest.license = license;
    const homepage = qrtl?.homepage ?? (pkg.homepage as string | undefined) ?? undefined;
    if (homepage) manifest.homepage = homepage;
    const repo = Helpers.normalizeRepository(qrtl?.repository ?? pkg.repository);
    if (repo) manifest.repository = repo;
    const author = Helpers.normalizeAuthor(qrtl?.author ?? pkg.author);
    if (author) manifest.author = author;
    const rawKeywords = qrtl?.keywords ?? pkg.keywords;
    const keywords = Array.isArray(rawKeywords)
      ? (rawKeywords as unknown[]).filter((k): k is string => typeof k === "string")
      : [];
    if (keywords.length) manifest.keywords = keywords;
    return manifest;
  }

  /** Normalizes npm's `author` (string shorthand `"Name <email> (url)"` or object) to {@link PluginAuthor}. */
  private static normalizeAuthor(author: unknown): PluginAuthor | undefined {
    if (typeof author === "string") {
      const email = /<([^>]+)>/.exec(author)?.[1];
      const url = /\(([^)]+)\)/.exec(author)?.[1];
      const name = author.replace(/<[^>]*>/, "").replace(/\([^)]*\)/, "").trim();
      if (!name) return undefined;
      return { name, ...(email ? { email } : {}), ...(url ? { url } : {}) };
    }
    if (author && typeof author === "object") {
      const a = author as { name?: string; email?: string; url?: string };
      if (!a.name) return undefined;
      return { name: a.name, ...(a.email ? { email: a.email } : {}), ...(a.url ? { url: a.url } : {}) };
    }
    return undefined;
  }

  /**
   * Normalizes npm's `repository` (string shorthand or object) to the manifest shape, preserving
   * `directory` — the plugin's folder inside the repo, which docs links need and which cannot be
   * derived from the plugin name.
   */
  private static normalizeRepository(repository: unknown): PluginRepository | undefined {
    if (typeof repository === "string") return { type: "git", url: repository };
    if (repository && typeof repository === "object") {
      const r = repository as { type?: string; url?: string; directory?: string };
      if (r.url) {
        return {
          type: r.type ?? "git",
          url: r.url,
          ...(r.directory ? { directory: r.directory } : {}),
        };
      }
    }
    return undefined;
  }

  /** Normalizes `style.icons` entries (MCP icon schema), filling in default size and MIME type.
   * @param style Raw `style` object from the `qrtl.config` manifest.
   */
  static normalizeStyleIcons(style: Record<string, unknown>): PluginIcon[] {
    const raw = style as { icons?: Array<Record<string, unknown>> };

    const normalizeEntry = (entry: Record<string, unknown>): PluginIcon => {
      const src = (entry.src ?? DEFAULT_ICON_SRC) as string;
      const rawSizes = entry.sizes as string[] | undefined;
      const icon: PluginIcon = { src, sizes: rawSizes?.length ? rawSizes : DEFAULT_ICON_SIZES };
      if (typeof entry.mimeType === "string") icon.mimeType = entry.mimeType;
      if (entry.theme === "light" || entry.theme === "dark") icon.theme = entry.theme;
      if (!icon.mimeType) icon.mimeType = guessIconMimeType(src);
      return icon;
    };

    if (Array.isArray(raw.icons) && raw.icons.length > 0) {
      return raw.icons.map((entry) => normalizeEntry(entry));
    }
    return [normalizeEntry({ src: DEFAULT_ICON_SRC })];
  }
}
