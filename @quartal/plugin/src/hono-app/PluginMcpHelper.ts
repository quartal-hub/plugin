import { join } from "node:path";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { StreamableHTTPTransport } from "@hono/mcp";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  SetLevelRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { buildMcpTools } from "../code/buildMcpTools.ts";
import type { PluginManifest, ExecuteFn, McpServerOptions, McpToolDescriptor, PluginAppConfig } from "../model/index.ts";
import { Helpers } from "../helpers/Helpers.ts";
import type { PluginApiHelper } from "./PluginApiHelper.ts";
import { buildMcpServerImplementation } from "./pluginIcon.ts";
import { WIDGET_MIME_TYPE, type WidgetEntry } from "../widgets/widgetTypes.ts";
import {
  defaultFetchWidgetHtml,
  type FetchWidgetHtml,
  rewriteWidgetHtml,
  withWidgetOrigin,
} from "../widgets/runtimeWidgets.ts";

/** The slice of the SDK's per-request handler extra this helper reads (HTTP request headers). */
interface RequestExtraLike {
  requestInfo?: { headers?: Record<string, string | string[] | undefined> };
}

/**
 * Builds an MCP server (Streamable HTTP) from pre-generated or runtime tool metadata. Mount at `/mcp`.
 *
 * Widgets are supplied by the caller (`applyToApp`'s `widgets` argument — resolved by
 * `resolveWidgetEntries` from `src/pages/widgets/` + `qrtl.config`). `resources/read` serves the live
 * Astro widget page with its asset URLs rewritten to the serving origin and the origin whitelisted in
 * the widget CSP — see `../widgets/runtimeWidgets.ts`.
 */
export class PluginMcpHelper {
  private readonly manifest: PluginManifest;
  private readonly toolEntries: McpToolDescriptor[];
  private readonly widgets: WidgetEntry[];
  private readonly widgetsByToolId: Map<string, WidgetEntry>;
  private readonly widgetsByUri: Map<string, WidgetEntry>;
  private readonly execute: ExecuteFn;
  private readonly serverOptions: McpServerOptions;
  private readonly fetchWidgetHtml: FetchWidgetHtml;
  private serverOrigin = "";
  private transport: StreamableHTTPTransport | null = null;
  private initPromise: Promise<StreamableHTTPTransport> | null = null;

  /** Mounts an MCP server at `/mcp` on `app`, wiring auth middleware and supplied widgets.
   * @param app Hono app to mount the MCP routes on.
   * @param helper Shared hub API helper (metadata, execution).
   * @param config Optional plugin app configuration.
   * @param widgets Resolved widget entries to advertise as UI resources (served live on read).
   */
  public static async applyToApp(
    app: Hono,
    helper: PluginApiHelper,
    config?: PluginAppConfig,
    widgets: WidgetEntry[] = [],
  ): Promise<void> {
    if (!helper.codeFiles.length || config?.mcp === false) {
      return;
    }
    const baseDir = config?.pluginRootFolder ?? process.cwd();
    const hubDir = join(baseDir, helper.qrtlPluginDir);
    const toolEntries = await PluginMcpHelper.loadToolEntries(helper, hubDir);
    const mcpHelper = new PluginMcpHelper(
      helper,
      toolEntries,
      widgets,
      typeof config?.mcp === "object" ? config.mcp : undefined,
      config?.fetchWidgetHtml,
    );
    if (config?.auth?.middleware) {
      app.use("/mcp", config.auth.middleware);
    }
    app.route("/mcp", mcpHelper.getApp());
  }

  private static async loadToolEntries(helper: PluginApiHelper, hubDir: string): Promise<McpToolDescriptor[]> {
    const mcpJson = await Helpers.readIfExists(join(hubDir, "mcp-tools.json"));
    if (mcpJson) {
      const parsed = JSON.parse(mcpJson) as { tools?: McpToolDescriptor[] };
      if (parsed.tools && parsed.tools.length > 0) {
        return parsed.tools;
      }
    }
    return buildMcpTools(helper.codeFiles);
  }

  private constructor(
    apiHelper: PluginApiHelper,
    toolEntries: McpToolDescriptor[],
    widgets: WidgetEntry[],
    serverOptions?: McpServerOptions,
    fetchWidgetHtml?: FetchWidgetHtml,
  ) {
    this.manifest = apiHelper.manifest!;
    this.toolEntries = toolEntries;
    this.widgets = widgets;
    this.widgetsByToolId = new Map(widgets.map((w) => [w.toolId, w]));
    this.widgetsByUri = new Map(widgets.map((w) => [w.uri, w]));
    this.execute = apiHelper.execute;
    this.serverOptions = serverOptions ?? {};
    this.fetchWidgetHtml = fetchWidgetHtml ?? defaultFetchWidgetHtml;
  }

  /**
   * The origin the requesting client used, from the per-request `host`/`x-forwarded-proto` headers,
   * falling back to the origin of the request that created the transport. Widget HTML and CSP are
   * per-origin (multi-hostname deploys), so this must not latch onto the first request only.
   */
  private resolveOrigin(extra?: RequestExtraLike): string {
    const headers = extra?.requestInfo?.headers ?? {};
    const get = (key: string): string | undefined => {
      const value = headers[key];
      return Array.isArray(value) ? value[0] : value;
    };
    const host = get("host");
    if (!host) return this.serverOrigin;
    const proto = get("x-forwarded-proto")?.split(",")[0]?.trim()
      || (this.serverOrigin.startsWith("https:") ? "https" : "http");
    return `${proto}://${host}`;
  }

  /** Returns the Hono sub-app that handles the MCP Streamable HTTP transport. */
  getApp(): Hono {
    const app = new Hono();
    app.all("/*", async (c) => {
      const transport = await this.ensureTransport(new URL(c.req.url).origin);
      return transport.handleRequest(c);
    });
    return app;
  }

  private ensureTransport(serverOrigin: string): Promise<StreamableHTTPTransport> {
    if (this.transport) return Promise.resolve(this.transport);
    if (!this.initPromise) {
      this.initPromise = this.createTransport(serverOrigin);
    }
    return this.initPromise;
  }

  private async createTransport(serverOrigin: string): Promise<StreamableHTTPTransport> {
    this.serverOrigin = serverOrigin;
    const hasWidgets = this.widgets.length > 0;
    const capabilities: Record<string, unknown> = { tools: {}, logging: {} };
    if (hasWidgets) capabilities.resources = {};
    const mcpServer = new Server(
      buildMcpServerImplementation(this.manifest, this.serverOptions, serverOrigin),
      { capabilities },
    );

    // Accept logging/setLevel as a no-op — clients (MCPJam, Inspector) send it on connect.
    mcpServer.setRequestHandler(SetLevelRequestSchema, () => ({}));

    mcpServer.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: this.toolEntries.map(({ id, title, description, inputSchema }) => {
        const widgetEntry = this.widgetsByToolId.get(id);
        return {
          name: id,
          ...(title ? { title } : {}),
          description,
          inputSchema,
          ...(widgetEntry ? { _meta: { ui: { resourceUri: widgetEntry.uri } } } : {}),
        };
      }),
    }));

    if (hasWidgets) {
      mcpServer.setRequestHandler(ListResourcesRequestSchema, (_request, extra) => {
        const origin = this.resolveOrigin(extra as RequestExtraLike);
        return {
          resources: this.widgets.map((w) => ({
            uri: w.uri,
            name: w.name,
            mimeType: WIDGET_MIME_TYPE,
            _meta: { ui: { csp: withWidgetOrigin(w.csp, origin) } },
          })),
        };
      });

      mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request: { params: { uri: string } }, extra) => {
        const uri = request.params.uri;
        const widgetEntry = this.widgetsByUri.get(uri);
        if (!widgetEntry) {
          throw new Error(`Unknown resource: ${uri}`);
        }
        // Serve the live widget page: fetch it from this origin, then make it renderable inside the
        // host's base-URL-less sandbox — asset URLs become absolute (via /widget-assets for CORS) and
        // the origin is whitelisted in the CSP.
        const origin = this.resolveOrigin(extra as RequestExtraLike);
        const html = await this.fetchWidgetHtml(widgetEntry, origin);
        if (html == null) {
          throw new Error(
            `Widget page "${widgetEntry.pagePath ?? `/widgets/${widgetEntry.toolId}`}" could not be rendered on ${origin}`,
          );
        }
        // `_meta` on the content item (SEP-1865) AND at the top level (older hosts) — spec-compatible.
        const cspMeta = { _meta: { ui: { csp: withWidgetOrigin(widgetEntry.csp, origin) } } };
        return {
          contents: [{
            uri: widgetEntry.uri,
            mimeType: WIDGET_MIME_TYPE,
            text: rewriteWidgetHtml(html, origin),
            ...cspMeta,
          }],
          ...cspMeta,
        };
      });
    }

    mcpServer.setRequestHandler(
      CallToolRequestSchema,
      async (request, extra) => {
        const { name: toolName, arguments: args } = request.params;
        // Coerce the SDK's IsomorphicHeaders (values may be string[]) to Record<string,string>.
        const rawHeaders = extra.requestInfo?.headers ?? {};
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(rawHeaders)) {
          if (typeof v === "string") headers[k] = v;
          else if (Array.isArray(v)) headers[k] = v.join(", ");
        }

        if (typeof toolName !== "string") {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Invalid tool name" }) }],
            isError: true,
          };
        }

        const match = this.toolEntries.find((t) => t.id === toolName);
        if (!match) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Invalid tool name" }) }],
            isError: true,
          };
        }

        const { fileName, className, methodName } = match;
        const params = (args && typeof args === "object" && !Array.isArray(args)) ? (args as Record<string, unknown>) : {};
        try {
          const result = await this.execute(fileName, className, methodName, params, { headers });
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
          };
        } catch (err) {
          if (err instanceof HTTPException) throw err;
          const text = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: text }) }],
            isError: true,
          };
        }
      },
    );

    const transport = new StreamableHTTPTransport();
    await mcpServer.connect(transport);
    this.transport = transport;
    return transport;
  }
}
