import { join } from "node:path";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  createMcpHandler,
  INVALID_PARAMS,
  ProtocolError,
  Server,
  type McpHttpHandler,
} from "@modelcontextprotocol/server";
import { z } from "@hono/zod-openapi";

import { buildMcpTools } from "../code/buildMcpTools.ts";
import type {
  PluginManifest,
  ExecuteFn,
  FetchWidgetHtml,
  McpPromptDescriptor,
  McpServerOptions,
  McpToolDescriptor,
  PluginAppConfig,
  PromptMessage,
  PromptResult,
  WidgetEntry,
} from "../model/index.ts";
import { Helpers } from "../helpers/Helpers.ts";
import type { FunctionZodDefinition } from "../code/ZodBuilder.ts";
import type { PluginApiHelper } from "./PluginApiHelper.ts";
import { buildMcpServerImplementation } from "./pluginIcon.ts";
import {
  defaultFetchWidgetHtml,
  rewriteWidgetHtml,
  WIDGET_MIME_TYPE,
  withWidgetOrigin,
} from "../widgets/runtimeWidgets.ts";

/** The slice of the SDK's per-request handler context this helper reads (the HTTP request). */
interface RequestContextLike {
  http?: { req?: Request };
}

/**
 * Builds an MCP server from pre-generated or runtime tool metadata. Mount at `/mcp`.
 *
 * Serving goes through the SDK's `createMcpHandler`: 2026-07-28 (per-request envelope) traffic is
 * served natively, and 2025-era clients keep working through the handler's built-in stateless
 * legacy fallback — one server factory backs both eras.
 *
 * Widgets are supplied by the caller (`applyToApp`'s `widgets` argument — resolved by
 * `resolveWidgetEntries` from `src/pages/widgets/` + `qrtl.config`). `resources/read` serves the live
 * Astro widget page with its asset URLs rewritten to the serving origin and the origin whitelisted in
 * the widget CSP — see `../widgets/runtimeWidgets.ts`.
 */
export class PluginMcpHelper {
  private readonly manifest: PluginManifest;
  private readonly toolEntries: McpToolDescriptor[];
  private readonly promptEntries: McpPromptDescriptor[];
  private readonly executePrompt: PluginApiHelper["executePrompt"];
  private readonly widgets: WidgetEntry[];
  private readonly widgetsByToolId: Map<string, WidgetEntry>;
  private readonly widgetsByUri: Map<string, WidgetEntry>;
  private readonly execute: ExecuteFn;
  private readonly getFunctionDef: (className: string, methodName: string) => FunctionZodDefinition | undefined;
  private readonly serverOptions: McpServerOptions;
  private readonly fetchWidgetHtml: FetchWidgetHtml;
  private serverOrigin = "";
  private handler: McpHttpHandler | null = null;

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
    if ((!helper.codeFiles.length && !helper.mcpPrompts.length) || config?.mcp === false) {
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
    this.promptEntries = apiHelper.mcpPrompts;
    this.widgets = widgets;
    this.widgetsByToolId = new Map(widgets.map((w) => [w.toolId, w]));
    this.widgetsByUri = new Map(widgets.map((w) => [w.uri, w]));
    // The strict variant: failures throw, so the tools/call handler below can report them per the
    // MCP spec (`isError: true`) instead of returning `{ error }` as a success-shaped result.
    this.execute = apiHelper.executeStrict;
    this.getFunctionDef = (className, methodName) => apiHelper.getFunctionDef(className, methodName);
    this.executePrompt = apiHelper.executePrompt;
    this.serverOptions = serverOptions ?? {};
    this.fetchWidgetHtml = fetchWidgetHtml ?? defaultFetchWidgetHtml;
  }

  /**
   * The origin the requesting client used, from the per-request `host`/`x-forwarded-proto` headers,
   * falling back to the origin of the request that created the transport. Widget HTML and CSP are
   * per-origin (multi-hostname deploys), so this must not latch onto the first request only.
   */
  private resolveOrigin(ctx?: RequestContextLike): string {
    const headers = ctx?.http?.req?.headers;
    const host = headers?.get("host");
    if (!host) return this.serverOrigin;
    const proto = headers?.get("x-forwarded-proto")?.split(",")[0]?.trim()
      || (this.serverOrigin.startsWith("https:") ? "https" : "http");
    return `${proto}://${host}`;
  }

  /** Headers of the per-request HTTP request as a plain record (for the execute/prompt auth context). */
  private static headersRecord(ctx: RequestContextLike): Record<string, string> {
    const headers: Record<string, string> = {};
    ctx.http?.req?.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  /** Returns the Hono sub-app that serves MCP via `createMcpHandler` (modern + legacy fallback). */
  getApp(): Hono {
    const app = new Hono();
    app.all("/*", (c) => {
      // Fallback origin for requests without a `host` header — latched from the first request,
      // matching the previous transport-creation-time behavior. `resolveOrigin` prefers the
      // per-request headers.
      if (!this.serverOrigin) this.serverOrigin = new URL(c.req.url).origin;
      this.handler ??= createMcpHandler(() => this.buildServer());
      return this.handler.fetch(c.req.raw);
    });
    return app;
  }

  /**
   * Builds a fresh `Server` for one serving unit — `createMcpHandler` calls this once per HTTP
   * request (modern 2026-07-28 exchanges and stateless legacy requests alike), so instances hold
   * no cross-request state.
   */
  private buildServer(): Server {
    const hasWidgets = this.widgets.length > 0;
    const hasPrompts = this.promptEntries.length > 0;
    const capabilities: Record<string, unknown> = { tools: {}, logging: {} };
    if (hasWidgets) capabilities.resources = {};
    if (hasPrompts) capabilities.prompts = {};
    const mcpServer = new Server(
      buildMcpServerImplementation(this.manifest, this.serverOptions, this.serverOrigin),
      { capabilities },
    );

    // logging/setLevel needs no handler here — declaring the `logging` capability makes the v2 SDK
    // register its built-in one for legacy (2025-era) clients (MCPJam and Inspector send setLevel
    // on connect). 2026-07-28 clients pass `logLevel` per request in `_meta` instead; no handler
    // is involved.

    // The generator always emits `type: "object"` schemas (see buildToolInputSchema /
    // buildToolOutputSchema), which the SDK's Tool type requires but our JSON-level
    // McpToolDescriptor cannot express — hence the cast.
    type ObjectSchema = { type: "object"; [key: string]: unknown };
    mcpServer.setRequestHandler("tools/list", () => ({
      tools: this.toolEntries.map(({ id, title, description, inputSchema, outputSchema, visibility }) => {
        const widgetEntry = this.widgetsByToolId.get(id);
        // MCP Apps `_meta.ui` (SEP-1865): the tool's UI resource and its visibility scopes.
        const ui = {
          ...(widgetEntry ? { resourceUri: widgetEntry.uri } : {}),
          ...(visibility ? { visibility } : {}),
        };
        return {
          name: id,
          ...(title ? { title } : {}),
          description,
          inputSchema: inputSchema as ObjectSchema,
          ...(outputSchema ? { outputSchema: outputSchema as ObjectSchema } : {}),
          ...(Object.keys(ui).length > 0 ? { _meta: { ui } } : {}),
        };
      }),
    }));

    if (hasWidgets) {
      mcpServer.setRequestHandler("resources/list", (_request, ctx) => {
        const origin = this.resolveOrigin(ctx);
        return {
          resources: this.widgets.map((w) => ({
            uri: w.uri,
            name: w.name,
            mimeType: WIDGET_MIME_TYPE,
            _meta: { ui: { csp: withWidgetOrigin(w.csp, origin) } },
          })),
        };
      });

      mcpServer.setRequestHandler("resources/read", async (request, ctx) => {
        const uri = request.params.uri;
        const widgetEntry = this.widgetsByUri.get(uri);
        if (!widgetEntry) {
          throw new Error(`Unknown resource: ${uri}`);
        }
        // Serve the live widget page: fetch it from this origin, then make it renderable inside the
        // host's base-URL-less sandbox — asset URLs become absolute (via /widget-assets for CORS) and
        // the origin is whitelisted in the CSP.
        const origin = this.resolveOrigin(ctx);
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

    if (hasPrompts) {
      mcpServer.setRequestHandler("prompts/list", () => ({
        prompts: this.promptEntries.map(({ id, title, description, arguments: args }) => ({
          name: id,
          ...(title ? { title } : {}),
          description,
          ...(args.length ? { arguments: args } : {}),
        })),
      }));

      mcpServer.setRequestHandler("prompts/get", async (request, ctx) => {
        const { name: promptName, arguments: args } = request.params;
        const match = this.promptEntries.find((p) => p.id === promptName);
        if (!match) {
          throw new Error(`Unknown prompt: ${String(promptName)}`);
        }

        const headers = PluginMcpHelper.headersRecord(ctx);
        const { fileName, className, methodName } = match;
        const input = (args && typeof args === "object" && !Array.isArray(args))
          ? (args as Record<string, unknown>)
          : {};
        const result = await this.executePrompt(fileName, className, methodName, input, { headers });
        return toGetPromptResult(result, match);
      });
    }

    mcpServer.setRequestHandler(
      "tools/call",
      async (request, ctx) => {
        const { name: toolName, arguments: args } = request.params;
        const headers = PluginMcpHelper.headersRecord(ctx);

        // Per the MCP spec, an unknown tool is a protocol error (-32602 Invalid params), not a
        // tool result.
        const match = this.toolEntries.find((t) => t.id === toolName);
        if (!match) {
          throw new ProtocolError(INVALID_PARAMS, `Unknown tool: ${String(toolName)}`);
        }

        const { fileName, className, methodName } = match;
        let params = (args && typeof args === "object" && !Array.isArray(args)) ? (args as Record<string, unknown>) : {};

        // Validate against the same Zod input schema the REST route uses. Invalid arguments are a
        // protocol error per the MCP spec; the Zod issue tree rides along as `data`.
        const def = this.getFunctionDef(className, methodName);
        if (def) {
          const parsed = def.input.safeParse(params);
          if (!parsed.success) {
            throw new ProtocolError(
              INVALID_PARAMS,
              `Invalid arguments for tool ${String(toolName)}: ${parsed.error.issues
                .map((issue: z.core.$ZodIssue) => `${issue.path.join(".") || "(input)"}: ${issue.message}`)
                .join("; ")}`,
              z.treeifyError(parsed.error),
            );
          }
          params = parsed.data;
        }

        try {
          const result = await this.execute(fileName, className, methodName, params, { headers });
          // `structuredContent` first, then the spec's backwards-compat serialized-JSON text block
          // ("a tool that returns structured content SHOULD also return the serialized JSON in a
          // TextContent block") — structured data leads when inspecting the raw result in MCPJam.
          return {
            structuredContent: result,
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
          };
        } catch (err) {
          if (err instanceof HTTPException) throw err;
          if (err instanceof ProtocolError) throw err;
          // Tool execution errors are reported inside the result with `isError: true` (MCP spec).
          // No `structuredContent`: it must conform to the tool's outputSchema, which an error
          // message does not.
          const text = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text }],
            isError: true,
          };
        }
      },
    );

    return mcpServer;
  }
}

/**
 * Normalizes a prompt function's return value into the MCP `prompts/get` result shape. A plain
 * string becomes a single `user` text message; a `PromptResponse` passes through (with the prompt's
 * description as the default).
 */
function toGetPromptResult(
  result: PromptResult,
  descriptor: McpPromptDescriptor,
): { description?: string; messages: PromptMessage[] } {
  if (typeof result === "string") {
    return {
      description: descriptor.description,
      messages: [{ role: "user", content: { type: "text", text: result } }],
    };
  }
  if (result && typeof result === "object" && Array.isArray(result.messages)) {
    return {
      description: result.description ?? descriptor.description,
      messages: result.messages,
    };
  }
  throw new Error(
    `Prompt "${descriptor.id}" returned an unexpected value; expected a string or a { messages } response object.`,
  );
}
