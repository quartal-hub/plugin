import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_ICON_SIZES, derivePluginTitle } from "../hono-app/pluginMetadata.ts";
import { guessIconMimeType } from "../hono-app/pluginIcon.ts";
import type { PluginManifest, PluginIcon, PluginRepository } from "../model/index.ts";
import type { QrtlConfig } from "../model/QrtlConfig.ts";

const DEFAULT_ICON_SRC = "https://cdn.quartal.com/img/logo/quartal-logo-q.png";
const DEFAULT_LOGO = "https://cdn.quartal.com/img/logo/quartal-logo-vertical.png";

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
   * Reads the plugin manifest: identity (name/version/description/license/repository) from
   * `package.json`, overlaid with `qrtl.config` metadata (title, style, …). This is the single
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
   * Loads `qrtl.config` from a plugin root, trying `.json`, then `.ts` / `.mjs` / `.js` (default or
   * named `config` export). Returns `undefined` when none is present.
   * @param dir Plugin root directory.
   */
  static async loadQrtlConfig(dir: string): Promise<QrtlConfig | undefined> {
    const jsonRaw = await Helpers.readIfExists(join(dir, "qrtl.config.json"));
    if (jsonRaw !== undefined) return JSON.parse(jsonRaw) as QrtlConfig;
    for (const ext of ["ts", "mjs", "js"] as const) {
      const path = join(dir, `qrtl.config.${ext}`);
      if (await Helpers.readIfExists(path) !== undefined) {
        try {
          // @vite-ignore — resolved at runtime from disk; not statically analyzable by Vite.
          const mod = (await import(/* @vite-ignore */ pathToFileURL(path).href)) as {
            default?: QrtlConfig;
            config?: QrtlConfig;
          };
          return mod.default ?? mod.config;
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  /** Builds a {@link PluginManifest} from an npm `package.json` overlaid with a `qrtl.config`. */
  private static buildManifestFromNpm(pkg: Record<string, unknown>, qrtl?: QrtlConfig): PluginManifest {
    const name = qrtl?.name ?? (pkg.name as string | undefined) ?? "Unknown";
    const description = qrtl?.description ?? (pkg.description as string | undefined) ?? "No description";
    const rawStyle = { ...(qrtl?.style ?? {}) } as Record<string, unknown>;
    const manifest: PluginManifest = {
      name,
      title: qrtl?.title ?? derivePluginTitle(name, description),
      description,
      version: (pkg.version as string | undefined) ?? "1.0.0",
      style: {
        logo: qrtl?.style?.logo ?? DEFAULT_LOGO,
        icons: Helpers.normalizeStyleIcons(rawStyle),
      },
    };
    if (qrtl?.style?.skin) manifest.style.skin = qrtl.style.skin;
    const license = (pkg.license as string | undefined) ?? undefined;
    if (license) manifest.license = license;
    const homepage = (pkg.homepage as string | undefined) ?? undefined;
    if (homepage) manifest.homepage = homepage;
    const repo = Helpers.normalizeRepository(pkg.repository);
    if (repo) manifest.repository = repo;
    return manifest;
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
