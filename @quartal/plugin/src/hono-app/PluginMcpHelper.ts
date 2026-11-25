import { Hono, type MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  createMcpHandler,
  createRequestStateCodec,
  INVALID_PARAMS,
  inputRequired,
  type RequestStateCodec,
  McpServer,
  ProtocolError,
  ResourceTemplate,
  type InputRequests,
  type McpHttpHandler,
} from "@modelcontextprotocol/server";
import { z } from "@hono/zod-openapi";

import { resolveMcpServers, type ResolvedLocalMcpServer } from "../agent-plugin/resolveMcpServers.ts";
import type {
  ElicitationContext,
  FileStaging,
  ToolCallFiles,
  PluginManifest,
  ExecuteFn,
  FetchWidgetHtml,
  ListToolsResult,
  McpPromptDescriptor,
  McpResourceDescriptor,
  McpServerOptions,
  McpToolDescriptor,
  PluginAppConfig,
  PromptMessage,
  PromptResult,
  ToolObjectSchema,
  WidgetEntry,
} from "../model/index.ts";
import type { FunctionZodDefinition } from "../code/ZodBuilder.ts";
import type { PluginApiHelper } from "./PluginApiHelper.ts";
import { buildMcpServerImplementation } from "./pluginIcon.ts";
import { PluginSkillCatalog } from "./PluginSkillCatalog.ts";
import { InputRequiredSignal } from "../elicit/InputRequiredSignal.ts";
import { toReadResourceResult } from "./toReadResourceResult.ts";
import {
  fileArguments,
  FILES_EXTENSION_ID,
  resolveToolCallFiles,
  type FileUploadState,
} from "../files/resolveToolCallFiles.ts";
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
  /** The REST mirrors of the MCP list results, served next to each server's protocol endpoint. */
  /** Inline file bytes accepted per `tools/call` (the files extension's `maxInlineBytes`). */
  private static readonly MAX_INLINE_BYTES = 4 * 1024 * 1024;
  /** The first protocol revision with input-required results (MRTR), which elicitation needs. */
  private static readonly MRTR_PROTOCOL_VERSION = "2026-07-28";
  private static readonly LIST_FILES = ["tools.json", "prompts.json", "resources.json", "skills.json"] as const;

  private readonly manifest: PluginManifest;
  private readonly toolEntries: McpToolDescriptor[];
  private readonly promptEntries: McpPromptDescriptor[];
  private readonly executePrompt: PluginApiHelper["executePrompt"];
  private readonly executeResource: PluginApiHelper["executeResource"];
  private readonly resourceEntries: McpResourceDescriptor[];
  private readonly widgets: WidgetEntry[];
  private readonly widgetsByToolId: Map<string, WidgetEntry>;
  private readonly widgetsByUri: Map<string, WidgetEntry>;
  private readonly execute: ExecuteFn;
  private readonly getFunctionDef: (className: string, methodName: string) => FunctionZodDefinition | undefined;
  private readonly serverOptions: McpServerOptions;
  private readonly fetchWidgetHtml: FetchWidgetHtml;
  private readonly skills: PluginSkillCatalog | undefined;
  private readonly fileStaging: FileStaging | undefined;
  /** Seals the files extension's request-state; absent without `QRTL_REQUEST_STATE_SECRET`. */
  private readonly stateCodec: RequestStateCodec<FileUploadState> | undefined;
  private serverOrigin = "";
  private handler: McpHttpHandler | null = null;

  /**
   * Mounts the plugin's MCP server(s) on `app`, wiring auth middleware and supplied widgets. The
   * main server serves at `/mcp`; additional local servers from `mcp.servers` mount at
   * `/mcp/<name>` with their subset of tool classes (widgets follow their tools; prompts, resources
   * and skills stay on the main server). External servers are declaration-only (`mcp.json`) and are not
   * mounted. The auth middleware guards the MCP protocol; every server's list mirrors
   * (`GET tools.json` / `prompts.json` / `resources.json` / `skills.json`) are public.
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
    if (config?.mcp === false) return;
    const baseDir = config?.pluginRootFolder ?? process.cwd();
    const skills = new PluginSkillCatalog(baseDir, config?.artifacts?.files);
    if (!helper.codeFiles.length && !helper.mcpPrompts.length && !helper.mcpResources.length && !(await skills.get())) {
      return;
    }
    const toolEntries = helper.getMcpTools();
    const mcpOptions = typeof config?.mcp === "object" ? config.mcp : undefined;

    const { local } = resolveMcpServers(helper.manifest!, mcpOptions);

    const authMiddleware = config?.auth?.middleware;
    if (authMiddleware) {
      // The list mirrors (`tools.json` / `prompts.json` / `resources.json`) only describe the
      // plugin, and the same schemas are public through `/open-api.json` and the docs pages, so
      // they stay open for the docs UI. The MCP protocol itself needs a login.
      const publicPaths = new Set(
        local.flatMap((server) => PluginMcpHelper.LIST_FILES.map((file) => `${server.path}/${file}`)),
      );
      const mcpAuthMiddleware: MiddlewareHandler = (c, next) =>
        (c.req.method === "GET" || c.req.method === "HEAD") && publicPaths.has(c.req.path)
          ? next()
          : authMiddleware(c, next);
      app.use("/mcp", mcpAuthMiddleware);
      app.use("/mcp/*", mcpAuthMiddleware);
    }

    const mcpRoot = new Hono();
    const buildServerHelper = (server: ResolvedLocalMcpServer): PluginMcpHelper => {
      const classFilter = server.tools ? new Set(server.tools) : undefined;
      const serverTools = classFilter ? toolEntries.filter((t) => classFilter.has(t.className)) : toolEntries;
      const serverToolIds = new Set(serverTools.map((t) => t.id));
      return new PluginMcpHelper(
        helper,
        serverTools,
        widgets.filter((w) => serverToolIds.has(w.toolId)),
        server.main ? helper.mcpPrompts : [],
        { ...mcpOptions, ...(server.main ? {} : { name: server.name }) },
        config?.fetchWidgetHtml,
        server.main ? skills : undefined,
        server.main ? helper.mcpResources : [],
        config?.fileStaging,
      );
    };
    // Named sub-servers are registered before the main server's catch-all so `/mcp/<name>` wins.
    for (const server of local.filter((s) => !s.main)) {
      mcpRoot.route(`/${server.name}`, buildServerHelper(server).getApp());
    }
    const main = local.find((s) => s.main);
    if (main) {
      mcpRoot.route("/", buildServerHelper(main).getApp());
    }
    app.route("/mcp", mcpRoot);
  }

  private constructor(
    apiHelper: PluginApiHelper,
    toolEntries: McpToolDescriptor[],
    widgets: WidgetEntry[],
    promptEntries: McpPromptDescriptor[],
    serverOptions?: McpServerOptions,
    fetchWidgetHtml?: FetchWidgetHtml,
    skills?: PluginSkillCatalog,
    resourceEntries: McpResourceDescriptor[] = [],
    fileStaging?: FileStaging,
  ) {
    this.manifest = apiHelper.manifest!;
    this.toolEntries = toolEntries;
    this.promptEntries = promptEntries;
    this.widgets = widgets;
    this.widgetsByToolId = new Map(widgets.map((w) => [w.toolId, w]));
    this.widgetsByUri = new Map(widgets.map((w) => [w.uri, w]));
    // The strict variant: failures throw, so the tools/call handler below can report them per the
    // MCP spec (`isError: true`) instead of returning `{ error }` as a success-shaped result.
    this.execute = apiHelper.executeStrict;
    this.getFunctionDef = (className, methodName) => apiHelper.getFunctionDef(className, methodName);
    this.executePrompt = apiHelper.executePrompt;
    this.executeResource = apiHelper.executeResource;
    this.resourceEntries = resourceEntries;
    this.fileStaging = fileStaging;
    const secret = typeof process !== "undefined" ? process.env?.QRTL_REQUEST_STATE_SECRET : undefined;
    if (fileStaging && !secret) {
      console.warn("[qrtl-plugin] src/file-staging.ts is set but QRTL_REQUEST_STATE_SECRET is not (32+ characters): files are accepted inline only.");
    }
    this.stateCodec = fileStaging && secret ? createRequestStateCodec<FileUploadState>({ key: secret, ttlSeconds: 600 }) : undefined;
    this.serverOptions = serverOptions ?? {};
    this.fetchWidgetHtml = fetchWidgetHtml ?? defaultFetchWidgetHtml;
    this.skills = skills;
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

  /**
   * The elicitation state of one `tools/call`: which modes the client declared, and the answers a
   * retried call carries. Elicitation needs the 2026-07-28 revision (input-required results);
   * a 2025-era client gets `undefined`, so `elicitForm` / `elicitUrl` resolve with their fallback.
   * @param server The request's server (its negotiated version and client capabilities).
   * @param ctx The request handler context (`inputResponses` of a retried request).
   * @param schemas The tool's generated form schemas by key.
   */
  private elicitationFor(
    server: McpServer["server"],
    ctx: { mcpReq?: { inputResponses?: Record<string, unknown> } },
    schemas: Record<string, Record<string, unknown>>,
  ): ElicitationContext | undefined {
    const version = server.getNegotiatedProtocolVersion() ?? "";
    if (version < PluginMcpHelper.MRTR_PROTOCOL_VERSION) return undefined;
    const declared = server.getClientCapabilities()?.elicitation as { form?: unknown; url?: unknown } | undefined;
    if (!declared) return undefined;
    // An empty `elicitation: {}` declares form mode.
    const form = declared.form !== undefined || declared.url === undefined;
    const url = declared.url !== undefined;
    return { form, url, responses: ctx.mcpReq?.inputResponses ?? {}, schemas };
  }

  /** Headers of the per-request HTTP request as a plain record (for the execute/prompt auth context). */
  private static headersRecord(ctx: RequestContextLike): Record<string, string> {
    const headers: Record<string, string> = {};
    ctx.http?.req?.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  /**
   * Returns the Hono sub-app for this server: the REST mirror of the MCP list results
   * (`GET tools.json` / `prompts.json` / `resources.json` / `skills.json`, byte-equivalent to
   * `tools/list` / `prompts/list` / `resources/list` / `skills/list`) and the MCP protocol itself
   * via `createMcpHandler` (modern + legacy fallback) on everything else.
   */
  getApp(): Hono {
    const app = new Hono();
    // Mirror routes are registered before the protocol catch-all so a GET for them is never
    // swallowed by the MCP handler.
    app.get("/tools.json", (c) => c.json(this.listToolsResult()));
    app.get("/prompts.json", (c) => c.json(this.listPromptsResult()));
    app.get("/resources.json", (c) => c.json(this.listResourcesResult(new URL(c.req.url).origin)));
    app.get("/skills.json", async (c) => c.json(this.skills ? await this.skills.listResult() : { skills: [] }));
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

  /** The MCP `tools/list` result — one source for the protocol handler and `GET tools.json`. */
  private listToolsResult(): ListToolsResult {
    // The generator always emits `type: "object"` schemas (see buildToolInputSchema /
    // buildToolOutputSchema), which the SDK's Tool type requires but our JSON-level
    // McpToolDescriptor cannot express — hence the cast.
    return {
      tools: this.toolEntries.map(({ id, title, description, inputSchema, outputSchema, visibility, annotations }) => {
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
          inputSchema: inputSchema as ToolObjectSchema,
          ...(outputSchema ? { outputSchema: outputSchema as ToolObjectSchema } : {}),
          ...(annotations ? { annotations } : {}),
          ...(Object.keys(ui).length > 0 ? { _meta: { ui } } : {}),
        };
      }),
    };
  }

  /** The MCP `resources/list` result — one source for the protocol handler and `GET resources.json`. */
  private listResourcesResult(origin: string) {
    return {
      resources: [
        ...this.widgetResources(origin),
        ...this.resourceEntries.filter((r) => !r.template).map((r) => this.resourceListing(r)),
      ],
    };
  }

  /** The widgets as `resources/list` entries, with the CSP for the origin the client used. */
  private widgetResources(origin: string) {
    return this.widgets.map((w) => ({
      uri: w.uri,
      name: w.name,
      mimeType: WIDGET_MIME_TYPE,
      _meta: { ui: { csp: withWidgetOrigin(w.csp, origin) } },
    }));
  }

  /** A plugin resource's `resources/list` entry (or template metadata). */
  private resourceListing(r: McpResourceDescriptor) {
    return {
      uri: r.uri,
      name: r.id,
      ...(r.title ? { title: r.title } : {}),
      description: r.description,
      ...(r.mimeType ? { mimeType: r.mimeType } : {}),
    };
  }

  /** The MCP `prompts/list` result — one source for the protocol handler and `GET prompts.json`. */
  private listPromptsResult() {
    return {
      prompts: this.promptEntries.map(({ id, title, description, arguments: args }) => ({
        name: id,
        ...(title ? { title } : {}),
        description,
        ...(args.length ? { arguments: args } : {}),
      })),
    };
  }

  /**
   * Builds a fresh `McpServer` for one serving unit — `createMcpHandler` calls this once per HTTP
   * request (modern 2026-07-28 exchanges and stateless legacy requests alike), so instances hold
   * no cross-request state. Tools and prompts use raw request handlers on the underlying `Server`
   * (the generated schemas are JSON Schema, not SDK-registered Zod shapes); resources go through
   * `registerResource`, which lets the SDK's Skills extension share `resources/*` with widgets.
   */
  private async buildServer(): Promise<McpServer> {
    const hasWidgets = this.widgets.length > 0;
    const hasPrompts = this.promptEntries.length > 0;
    const capabilities: Record<string, unknown> = { tools: {}, logging: {} };
    if (hasPrompts) capabilities.prompts = {};
    const mcp = new McpServer(
      buildMcpServerImplementation(this.manifest, this.serverOptions, this.serverOrigin),
      { capabilities },
    );
    const mcpServer = mcp.server;
    // MCP files extension: inline files always; out-of-band uploads with a file staging + secret.
    mcpServer.registerCapabilities({
      extensions: {
        [FILES_EXTENSION_ID]: {
          ...(this.stateCodec ? { upload: {} } : {}),
          maxInlineBytes: PluginMcpHelper.MAX_INLINE_BYTES,
        },
      },
    } as never);

    // logging/setLevel needs no handler here — declaring the `logging` capability makes the v2 SDK
    // register its built-in one for legacy (2025-era) clients (MCPJam and Inspector send setLevel
    // on connect). 2026-07-28 clients pass `logLevel` per request in `_meta` instead; no handler
    // is involved.

    mcpServer.setRequestHandler("tools/list", () => this.listToolsResult());

    if (hasWidgets) {
      // One template for every widget: its `list` callback sees the request, so each listing
      // carries the CSP for the origin the client used.
      mcp.registerResource(
        "widgets",
        new ResourceTemplate("ui://widgets/{toolId}.html", {
          list: (ctx) => ({ resources: this.widgetResources(this.resolveOrigin(ctx)) }),
        }),
        { mimeType: WIDGET_MIME_TYPE },
        async (url, _variables, ctx) => {
          const uri = url.href;
          const widgetEntry = this.widgetsByUri.get(uri);
          if (!widgetEntry) {
            throw new ProtocolError(INVALID_PARAMS, `Unknown resource: ${uri}`);
          }
          // Serve the live widget page: fetch it from this origin, then make it renderable inside
          // the host's base-URL-less sandbox — asset URLs become absolute (via /widget-assets for
          // CORS) and the origin is whitelisted in the CSP.
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
        },
      );
    }

    // The plugin's own resources (`src/resources/`): fixed URIs and URI templates.
    for (const resource of this.resourceEntries) {
      const { uri: _uri, name: _name, ...metadata } = this.resourceListing(resource);
      const config = {
        ...metadata,
        ...(resource.cacheTtlMs !== undefined
          ? { cacheHint: { ttlMs: resource.cacheTtlMs, cacheScope: resource.cacheScope ?? "private" } }
          : {}),
      };
      const read = async (url: URL, variables: Record<string, unknown>, ctx: RequestContextLike) => {
        const value = await this.executeResource(resource, variables, { headers: PluginMcpHelper.headersRecord(ctx) });
        return toReadResourceResult(resource, url.href, value);
      };
      if (resource.template) {
        mcp.registerResource(
          resource.id,
          new ResourceTemplate(resource.uri, { list: undefined }),
          config,
          (url, variables, ctx) => read(url, variables, ctx),
        );
      } else {
        mcp.registerResource(resource.id, resource.uri, config, (url, ctx) => read(url, {}, ctx));
      }
    }

    const skills = await this.skills?.get();
    if (skills) skills.attach(mcp);

    if (hasPrompts) {
      mcpServer.setRequestHandler("prompts/list", () => this.listPromptsResult());

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

        // MCP files extension: receive the `McpFile` arguments before the tool runs.
        let files: ToolCallFiles | undefined;
        const fileArgs = fileArguments(match.inputSchema);
        if (fileArgs.length) {
          const clientFiles = mcpServer.getClientCapabilities()?.extensions?.[FILES_EXTENSION_ID] as
            { upload?: unknown; download?: unknown } | undefined;
          let state: FileUploadState | undefined;
          const rawState = (ctx as { mcpReq?: { requestState?: () => unknown } }).mcpReq?.requestState?.();
          if (typeof rawState === "string" && this.stateCodec) {
            try {
              state = await this.stateCodec.verify(rawState, ctx as never);
            } catch {
              throw new ProtocolError(INVALID_PARAMS, "Invalid or expired requestState");
            }
          }
          const received = await resolveToolCallFiles({
            tool: String(toolName),
            args: params,
            fileArgs,
            headers,
            clientUpload: clientFiles?.upload !== undefined,
            maxInlineBytes: PluginMcpHelper.MAX_INLINE_BYTES,
            staging: this.fileStaging,
            ...(this.stateCodec ? { mintState: (s: FileUploadState) => this.stateCodec!.mint(s, ctx as never) } : {}),
            ...(state ? { state } : {}),
          });
          if (received.kind === "upload") {
            return { content: [], resultType: "upload_required", uploads: received.uploads, requestState: received.requestState } as never;
          }
          if (received.kind === "missing-capability") {
            throw new ProtocolError(-32021, "This tool needs the files extension's upload capability", {
              requiredCapabilities: { extensions: { [FILES_EXTENSION_ID]: { upload: {} } } },
            });
          }
          if (received.kind === "mismatch") throw new ProtocolError(INVALID_PARAMS, received.message);
          if (received.kind === "refused") {
            return { content: [{ type: "text" as const, text: received.message }], isError: true };
          }
          files = { bytes: received.bytes, downloads: [] };
        }

        try {
          const elicitation = this.elicitationFor(mcpServer, ctx, match.elicitations ?? {});
          const callFiles: ToolCallFiles = files ?? { bytes: new Map(), downloads: [] };
          const result = await this.execute(fileName, className, methodName, params, {
            headers,
            ...(elicitation ? { elicitation } : {}),
            files: callFiles,
          });
          const clientDownload = (mcpServer.getClientCapabilities()?.extensions?.[FILES_EXTENSION_ID] as
            { download?: unknown } | undefined)?.download !== undefined;
          if (callFiles.downloads.length && clientDownload) {
            return {
              structuredContent: result,
              content: [{ type: "text" as const, text: JSON.stringify(result) }],
              _meta: { [FILES_EXTENSION_ID]: { downloads: callFiles.downloads } },
            };
          }
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
          // The tool asks the user something (MRTR, 2026-07-28): the client fulfils the requests and
          // retries this tools/call with `inputResponses`.
          if (err instanceof InputRequiredSignal) {
            return inputRequired({ inputRequests: err.inputRequests as unknown as InputRequests });
          }
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

    return mcp;
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
