import type {
  CodeFile,
  McpPromptDescriptor,
  McpToolDescriptor,
  PluginInfo,
  PluginManifest,
} from "@quartal/plugin-core";
import type { McpServerOptions } from "./McpServerOptions.ts";
import type { WidgetEntry } from "./WidgetEntry.ts";

/**
 * Build-time snapshot of the metadata the runtime otherwise reads from disk per request: the
 * generated `qrtl-plugin/*.json` artifacts plus the resolved manifest, README and `qrtl.config`
 * runtime options. Codegen emits it as the importable `qrtl-plugin/artifacts.ts` module, and the
 * generated Astro middleware passes it to `getAnonApp`/`getAuthApp` via
 * `PluginAppConfig.artifacts` — so a bundled deployment (serverless function, Worker) serves the
 * plugin without those files existing on disk.
 *
 * When the object is present, the app builders treat it as the authoritative snapshot and do not
 * load `qrtl.config` from disk; individual missing fields (e.g. `readme` for a plugin without a
 * README) fall back to their disk reads, which keeps tests and non-Astro hosts working with
 * partial injection.
 */
export interface PluginRuntimeArtifacts {
  /** Contents of the generated `tools.json` (analyzed code files). */
  tools?: { files?: CodeFile[] };
  /** Contents of the generated `open-api.json`. */
  openApi?: Record<string, unknown>;
  /** Contents of the generated `types.json`. */
  types?: unknown[];
  /** Contents of the generated `contents.json` (the unified plugin overview). */
  contents?: PluginInfo;
  /** Contents of the generated `mcp-tools.json`. */
  mcpTools?: { tools?: McpToolDescriptor[] };
  /** Contents of the generated `mcp-prompts.json`. */
  mcpPrompts?: { prompts?: McpPromptDescriptor[] };
  /** Plugin manifest resolved at build time from `package.json` + `qrtl.config`. */
  manifest?: PluginManifest;
  /** `README.md` text (absent when the plugin has none). */
  readme?: string;
  /** The `qrtl.config` `auth` mode, resolved at build time (default `"anon"`). */
  auth?: "anon" | "quartal-hub" | "custom";
  /** The `qrtl.config` `mcp` options (absent when not configured). */
  mcp?: McpServerOptions | boolean;
  /** Widget entries resolved at build time (`src/pages/widgets/` + the `qrtl.config` `widgets` section). */
  widgetResources?: WidgetEntry[];
}
