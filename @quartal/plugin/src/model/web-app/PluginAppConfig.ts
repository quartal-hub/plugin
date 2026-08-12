import type { MiddlewareHandler } from "hono";
import type { McpServerOptions } from "./McpServerOptions.ts";
import type { AuthContext } from "../AuthContext.ts";
import type { FetchWidgetHtml } from "./FetchWidgetHtml.ts";
import type { WidgetEntry } from "./WidgetEntry.ts";

/**
 * A static registry of tool modules keyed by file name (basename without extension). Generated as
 * `tools.registry.ts` by the codegen step and imported by the app entry / Astro integration, then
 * passed here.
 */
export type ToolModuleRegistry = Record<string, Record<string, unknown>>;

/**
 * Configuration for building and running the web app for a Quartal Plugin — the runtime contract of
 * `getAnonApp`/`getAuthApp`. Distinct from the Astro-facing `QrtlPluginOptions`: the integration
 * generates middleware source that calls the app builders with the serializable fields, while the
 * function-valued fields (`auth.middleware`, `execute`, `fetchWidgetHtml`) are injected by the
 * framework itself or by tests / non-Astro hosts.
 */
export interface PluginAppConfig {
  /**
   * Base folder for the plugin. Contains tools/, qrtl-plugin/, and the manifest. Defaults to the
   * current working directory.
   */
  pluginRootFolder?: string;

  /**
   * Directory (relative to {@link pluginRootFolder}) holding the generated artifacts
   * (`tools.json`, `mcp-tools.json`, `contents.json`, …). Default `"qrtl-plugin"`; the Astro
   * integration uses `"src/qrtl-plugin"`.
   */
  qrtlPluginDir?: string;

  /**
   * Static tool-module registry (from the generated `tools.registry.ts`). Required to execute
   * tools at runtime. When omitted, execution returns a helpful error.
   */
  toolModules?: ToolModuleRegistry;

  /**
   * Static prompt-module registry (from the generated `prompts.registry.ts`). Required to render
   * MCP prompts at runtime. When omitted, `prompts/get` returns a helpful error.
   */
  promptModules?: ToolModuleRegistry;

  /**
   * Explicit widget entries advertised as MCP Apps UI resources. When set, runtime widget-page
   * discovery is skipped (used by tests / non-Astro hosts). The entries carry no HTML — each
   * `resources/read` renders the live widget page. When omitted, widgets are discovered from
   * `src/pages/widgets/` with names/CSP from the `qrtl.config` `widgets` section.
   */
  widgetResources?: WidgetEntry[];

  /**
   * Renders a widget's live page HTML for `resources/read`. Defaults to fetching
   * `<origin><pagePath>` from the serving origin (a loopback request the Astro server answers).
   * Override in tests or on hosts where the app cannot reach its own origin.
   */
  fetchWidgetHtml?: FetchWidgetHtml;

  /**
   * Optional MCP server options (name). If not set, values from the manifest are used.
   * May be set to `false` to disable the MCP server. `true`/unset enables it.
   */
  mcp?: McpServerOptions | boolean;

  /** Defines the authentication scheme for the API. */
  auth?: {
    /** Auth scheme name, e.g. "oauth2Password" or "bearerAuth". */
    name: string;
    /** Auth scheme type, e.g. "http" for bearer auth or "oauth2" for OAuth2 flows. */
    type: string;
    /** Auth scheme (e.g. "bearer" for HTTP bearer). Required for type === "http". */
    scheme?: string;
    /** Optional bearer format, e.g. "JWT". */
    bearerFormat?: string;
    /** OpenAPI 3 OAuth2 flows object. Required when type === "oauth2". */
    flows?: Record<string, unknown>;
    /** Pre-filled OAuth client_id for the Swagger UI Authorize dialog. */
    clientId?: string;
    /** The authentication middleware that handles authentication. */
    middleware?: MiddlewareHandler;
  };

  /**
   * Method for executing the target method. Use this to inject environment-specific / auth context.
   * @param targetMethod Target function being called (single `input` param plus optional context args).
   * @param input Validated, potentially coerced input parameters from the request.
   * @param authContext Information for fetching the authentication context.
   * @returns The result of the target method (directly or as a promise).
   */
  execute?: <T>(
    targetMethod: (input: Record<string, unknown>, ...args: unknown[]) => T,
    input: Record<string, unknown>,
    authContext?: AuthContext,
  ) => Promise<T> | T;
}
