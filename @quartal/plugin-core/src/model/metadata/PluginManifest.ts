import type { PluginIcon } from "./PluginIcon.ts";

/** Source repository of a plugin, following npm's `repository` field. */
export interface PluginRepository {
  /** VCS type, practically always `git`. */
  type: string;
  /** Clone/browse URL of the repository (e.g. `https://github.com/owner/repo.git`). */
  url: string;
  /**
   * Path of this plugin's folder inside the repository, relative to the repo root and without a
   * leading `./` (e.g. `samples/test1`). Omitted when the plugin lives at the repository root.
   */
  directory?: string;
}

/**
 * The resolved plugin manifest: identity fields from the plugin's `package.json` overlaid with
 * `qrtl.config` metadata (title, style, …). Also the base of the served overview ({@link PluginInfo}).
 */
export interface PluginManifest {
  /** The identifying name of the plugin (e.g. `@samples/my-plugin`). */
  name: string;
  /** End-user-friendly title shown in docs and MCP. */
  title: string;
  /** Short description of the plugin. */
  description: string;
  /** The version of the plugin. */
  version: string;
  /** Primary public URL for this plugin (marketing site, product page, etc.). */
  homepage?: string;
  /** The license text describing the plugin's license. */
  license?: string;
  /** Visual elements for documentation, plugin listings etc. */
  style: {
    /**
     * The logo of the plugin: Shown in the front page and in the documentation where larger logo is appropriate.
     * Width should be at least 300px. Default is Quartal logo.
     */
    logo: string;
    /**
     * Bootstrap skin CSS URL (CDN). Injected into the docs SPA shell at serve time by the server.
     */
    skin?: string;
    /**
     * Icons (MCP schema). `src` is the source URI; bytes are served from `/icons/{index}` on this host.
     */
    icons: PluginIcon[];
  };
  /** For open source plugins, the repository URL. */
  repository?: PluginRepository;
}
