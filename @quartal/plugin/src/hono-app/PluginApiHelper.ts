import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

import { buildMcpCatalog } from "../code/buildMcpCatalog.ts";
import { buildMcpTools } from "../code/buildMcpTools.ts";
import { buildOpenApiTags } from "../code/buildOpenApiTags.ts";
import { loadCodeFiles } from "../code/loadCodeFiles.ts";
import { resolveRestRoutes } from "../code/resolveRestRoutes.ts";
import { type FunctionZodDefinition, type FunctionZodList, ZodBuilder } from "../code/ZodBuilder.ts";
import { Helpers } from "../helpers/Helpers.ts";
import { pluginGenerator } from "../helpers/pluginGenerator.ts";
import { InputRequiredSignal } from "../elicit/InputRequiredSignal.ts";
import { ELICITATION_HEADER, INPUT_RESPONSES_HEADER, restElicitation } from "../elicit/restElicitation.ts";
import { bindToolCallElicitation } from "../elicit/toolCallElicitation.ts";
import { bindToolCallFiles } from "../files/toolCallFiles.ts";
import { fileArguments, resolveToolCallFiles } from "../files/resolveToolCallFiles.ts";
import { buildAgentSummaries, buildPluginInfo, buildSkillSummaries } from "./buildPluginInfo.ts";
import { defaultValidationHook, registerOpenApiRoutes } from "./registerOpenApiRoutes.ts";
import { registerIconRoutes } from "./iconRoutes.ts";
import { buildOpenApiInfo, mcpServerDisplayName } from "./pluginMetadata.ts";
import type {
  AuthContext,
  CodeFile,
  PluginManifest,
  ExecuteFn,
  McpCatalog,
  McpPromptDescriptor,
  McpResourceDescriptor,
  McpToolDescriptor,
  QuartalPluginContext,
  PluginAppConfig,
  PluginInfo,
  PromptResult,
  WidgetCatalogEntry,
} from "../model/index.ts";

/**
 * Builds a Hono API that executes plugin tool methods. Loads pre-generated metadata from
 * `qrtl-plugin/` and executes methods via the injected static tool-module registry
 * (`config.toolModules`).
 *
 * Icon routes, the docs SPA, skills, MCP and public-folder routes are registered by the
 * surrounding app assembler (added in later migration phases).
 */
export class PluginApiHelper {
  private zodCreator: ZodBuilder | null = null;
  private functionDefs: FunctionZodList | null = null;
  private prebuiltOpenApi: Record<string, unknown> | null = null;
  private prebuiltTypes: unknown[] | null = null;
  private prebuiltContents: PluginInfo | null = null;
  private prebuiltMcpTools: McpToolDescriptor[] | null = null;
  private prebuiltMcpResources: McpResourceDescriptor[] | null = null;
  /** Tool descriptors built from the code files (no `mcp-tools.json`), kept while the code files stay the same. */
  private builtMcpTools: { from: CodeFile[]; tools: McpToolDescriptor[] } | undefined;
  private prebuiltMcpPrompts: McpPromptDescriptor[] | null = null;
  private widgetEntries: WidgetCatalogEntry[] = [];
  private baseDir: string;
  /** Directory (under {@link baseDir}) holding the generated artifacts. Default `"qrtl-plugin"`. */
  public readonly qrtlPluginDir: string;

  constructor(public readonly basePath: string = "/api", private readonly config: PluginAppConfig) {
    this.baseDir = config.pluginRootFolder ?? process.cwd();
    this.qrtlPluginDir = config.qrtlPluginDir ?? "qrtl-plugin";
  }

  /** Code files loaded from `qrtl-plugin/tools.json`. Available after `init()`. */
  public codeFiles: CodeFile[] = [];

  /** Plugin manifest. Available after `init()`. */
  public manifest: PluginManifest | undefined;

  /** Widget catalog entries (set from the runtime-resolved widgets by the app builders). */
  public get widgetCatalog(): WidgetCatalogEntry[] {
    return this.widgetEntries;
  }

  /** Sets the widget catalog used by the runtime-assembled plugin info / MCP catalog fallback. */
  public setWidgetCatalog(entries: WidgetCatalogEntry[]): void {
    this.widgetEntries = entries;
  }

  /** The README.md contents as the original Markdown. */
  public readmeContent: string | undefined;

  /** Loads the manifest, README and the generated `qrtl-plugin/` metadata (preferring the injected
   * build-time artifacts over disk reads). */
  public async init(): Promise<void> {
    this.manifest = this.config.artifacts?.manifest ?? await Helpers.getPluginManifest(this.baseDir);
    this.readmeContent = this.config.artifacts?.readme
      ?? await Helpers.readIfExists(join(this.baseDir, "README.md"))
      ?? "No README.md found in the plugin.";
    await this.prepareTools();
  }

  /** URL of the OpenAPI JSON document. */
  public get openApiUrl(): string {
    return `/open-api.json`;
  }

  /** In-memory MCP catalog derived from code files + configured widgets (feeds `contents.json`). */
  public getMcpCatalog(): McpCatalog {
    return buildMcpCatalog(this.codeFiles, this.widgetEntries, this.mcpPrompts, this.mcpResources);
  }

  /**
   * The generated elicitation form schemas of one tool method, by `elicitForm` key.
   * @param className The tool class.
   * @param methodName The tool method.
   */
  public getElicitationSchemas(className: string, methodName: string): Record<string, Record<string, unknown>> {
    const tool = this.getMcpTools().find((t) => t.className === className && t.methodName === methodName);
    return tool?.elicitations ?? {};
  }

  /** MCP tool descriptors: the generated `mcp-tools.json`, or built from the code files. Available after `init()`. */
  public getMcpTools(): McpToolDescriptor[] {
    if (this.prebuiltMcpTools) return this.prebuiltMcpTools;
    if (this.builtMcpTools?.from !== this.codeFiles) {
      this.builtMcpTools = { from: this.codeFiles, tools: buildMcpTools(this.codeFiles) };
    }
    return this.builtMcpTools.tools;
  }

  /** MCP resource descriptors loaded from `qrtl-plugin/mcp-resources.json`. Available after `init()`. */
  public get mcpResources(): McpResourceDescriptor[] {
    return this.prebuiltMcpResources ?? [];
  }

  /** MCP prompt descriptors loaded from `qrtl-plugin/mcp-prompts.json`. Available after `init()`. */
  public get mcpPrompts(): McpPromptDescriptor[] {
    return this.prebuiltMcpPrompts ?? [];
  }

  /**
   * The Zod definition (input/returns schemas) for a tool method, for callers that validate
   * outside the OpenAPI routes (the MCP `tools/call` path). Available after `init()`.
   * @param className The class name.
   * @param methodName The method name.
   */
  public getFunctionDef(className: string, methodName: string): FunctionZodDefinition | undefined {
    return this.zodCreator?.getZodForFunction(className, methodName);
  }

  /**
   * Unified plugin overview for `GET /plugin.json`: serves the generated `contents.json` (merging
   * the request origin into `homepage` when absent) and falls back to assembling it at runtime.
   * @param origin Request origin used for homepage resolution.
   */
  public async getPluginInfo(origin: string): Promise<PluginInfo> {
    if (this.prebuiltContents) {
      const base = this.prebuiltContents;
      if (origin && !this.manifest?.homepage && base.homepage !== origin) {
        return { ...base, homepage: origin };
      }
      return base;
    }
    const catalog = this.getMcpCatalog();
    const mcpTools = this.getMcpTools();
    const skills = await buildSkillSummaries(this.baseDir);
    return buildPluginInfo({
      manifest: this.manifest!,
      codeFiles: this.codeFiles,
      mcpTools,
      resources: catalog.resources,
      prompts: this.mcpPrompts,
      widgetCatalog: this.widgetEntries,
      skills,
      agents: await buildAgentSummaries(this.baseDir, this.manifest!.name, {
        pluginTools: mcpTools.map((t) => t.id),
        pluginServer: mcpServerDisplayName(this.manifest!.name),
        pluginSkills: skills.map((s) => s.name),
      }),
      basePath: this.basePath,
      hasReadme: !!this.readmeContent && this.readmeContent !== "No README.md found in the plugin.",
      origin,
      mcpOptions: typeof this.config.mcp === "object" ? this.config.mcp : undefined,
      generator: pluginGenerator(),
    });
  }

  /**
   * Returns an OpenAPIHono app with the API routes mounted: `/api/*` (one per tool method, Zod
   * validated), `/open-api.json`, `/types.json`, `/readme.md`.
   */
  getApiApp(): OpenAPIHono {
    const app = new OpenAPIHono();
    app.use(cors({
      origin: "*",
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "mcp-protocol-version",
        "mcp-session-id",
        ELICITATION_HEADER,
        INPUT_RESPONSES_HEADER,
      ],
    }));
    const manifest = this.manifest!;

    if (this.config.auth?.middleware) {
      app.use(this.basePath + "/*", this.config.auth.middleware);
    }

    if (manifest.style.icons.length > 0) {
      registerIconRoutes(app, manifest.style.icons);
    }

    if (this.codeFiles.length === 0 || !this.zodCreator || !manifest) {
      console.error("Code files, Zod creator or plugin info not found. Aborting API app creation.");
      return app;
    }

    app.get("/readme.md", (c) => c.text(this.readmeContent ?? "No README.md found in the plugin."));

    app.get("/types.json", (c) => {
      if (this.prebuiltTypes) return c.json(this.prebuiltTypes);
      const types = this.codeFiles.flatMap((file) => file.types);
      return c.json(types);
    });

    if (this.config.auth?.name) {
      const auth = this.config.auth;
      const scheme: Record<string, unknown> = { type: auth.type };
      if (auth.scheme) scheme.scheme = auth.scheme;
      if (auth.bearerFormat) scheme.bearerFormat = auth.bearerFormat;
      if (auth.flows) scheme.flows = auth.flows;
      app.openAPIRegistry.registerComponent("securitySchemes", auth.name, scheme as any);
    }

    const defs = this.functionDefs!;

    registerOpenApiRoutes(app, defs, {
      routes: resolveRestRoutes(this.codeFiles, this.basePath),
      authName: this.config.auth?.name,
      createValidationHook: defaultValidationHook,
      createHandler: ({ fileName, className, methodName, route }) => async (c: any) => {
        // The tool still receives one input object: path parameters merged with the query or body.
        const params: Record<string, unknown> = {
          ...(route.pathParams.length ? (c.req as any).valid("param") : {}),
          ...(route.inputIn === "query" ? (c.req as any).valid("query") : {}),
          ...(route.inputIn === "body" ? (c.req as any).valid("json") : {}),
        };
        // A failure is a thrown error, never the shape of the result: a tool may return an `error` field.
        // `HTTPException`s pass through so auth failures keep their HTTP semantics (e.g. 401 + WWW-Authenticate).
        let result: Record<string, unknown>;
        try {
          const elicitation = restElicitation(
            (name) => c.req.header(name),
            this.getElicitationSchemas(className, methodName),
          );
          const headers = { Authorization: c.req.header("Authorization") ?? "" };
          // `McpFile` arguments arrive inline (base64 `data`) over REST; they are checked like MCP ones.
          const tool = this.getMcpTools().find((t) => t.className === className && t.methodName === methodName);
          const fileArgs = tool ? fileArguments(tool.inputSchema) : [];
          let files;
          if (fileArgs.length) {
            const received = await resolveToolCallFiles({
              tool: tool!.id, args: params, fileArgs, headers, clientUpload: false,
              maxInlineBytes: Number.MAX_SAFE_INTEGER,
            });
            if (received.kind !== "ready") {
              const message = "message" in received ? received.message : "Send the files inline as base64 `data`.";
              return c.json({ error: message }, 422);
            }
            files = { bytes: received.bytes, downloads: [] };
          }
          result = await this.executeStrict(fileName, className, methodName, params, {
            headers,
            ...(elicitation ? { elicitation } : {}),
            ...(files ? { files } : {}),
          });
        } catch (error: unknown) {
          if (error instanceof HTTPException) throw error;
          // The tool asks the user something: 428 with the questions; the caller retries the same
          // request with the answers in `Qrtl-Input-Responses`.
          if (error instanceof InputRequiredSignal) {
            return c.json({ resultType: "input_required", inputRequests: error.inputRequests }, 428);
          }
          return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
        }
        return c.json(result);
      },
    });

    app.get(`/open-api.json`, (c) => {
      try {
        const origin = new URL(c.req.url).origin;
        if (this.prebuiltOpenApi) {
          return c.json(this.mergeRuntimeOpenApi(this.prebuiltOpenApi, origin));
        }
        const doc = app.getOpenAPIDocument({
          openapi: "3.0.0",
          info: buildOpenApiInfo(manifest, origin) as { version: string; title: string; description: string },
          tags: buildOpenApiTags(this.codeFiles),
        });
        return c.json(doc);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[open-api.json] Failed to generate OpenAPI document:", error);
        return c.json({ error: "Failed to generate OpenAPI document", details: message }, 500);
      }
    });

    return app;
  }

  /**
   * Executes a class method, resolving the class from the injected tool-module registry
   * (`config.toolModules`, generated as `tools.registry.ts`). Failures throw — resolution problems
   * and errors thrown by the tool method alike. The REST handler answers them with HTTP 500 and the
   * MCP `tools/call` handler reports them per the MCP spec (`isError: true`).
   * @param fileName File name without extension (letters, numbers, underscores, dashes).
   * @param className Class name within the file.
   * @param methodName Method name (static first, then instance).
   * @param input Validated input parameters.
   * @param authContext Authentication context carrier for the execute wrapper.
   * @returns Always an object; a non-object result is wrapped as `{ value }`.
   */
  executeStrict: ExecuteFn = async (
    fileName: string,
    className: string,
    methodName: string,
    input: Record<string, unknown>,
    authContext?: AuthContext,
  ): Promise<Record<string, unknown>> => {
    const result = await this.invoke(
      this.config.toolModules,
      "Tool module",
      "tools.registry.ts",
      "toolModules",
      fileName,
      className,
      methodName,
      input,
      authContext,
    );

    const isObject = typeof result === "object" && result !== null && !Array.isArray(result);
    return isObject ? (result as Record<string, unknown>) : { value: result ?? null };
  };

  /**
   * Executes a prompt function, resolving the class from the injected prompt-module registry
   * (`config.promptModules`, generated as `prompts.registry.ts`). Unlike {@link executeStrict}, the raw
   * return value is preserved (a `string` or a `PromptResponse`). Failures throw — the MCP
   * `prompts/get` handler turns them into protocol errors.
   * @param fileName File name without extension (letters, numbers, underscores, dashes).
   * @param className Class name within the file.
   * @param methodName Method name (static first, then instance).
   * @param input Prompt arguments (string-valued, per the MCP prompt spec).
   * @param authContext Authentication context carrier for the execute wrapper.
   */
  executePrompt = async (
    fileName: string,
    className: string,
    methodName: string,
    input: Record<string, unknown>,
    authContext?: AuthContext,
  ): Promise<PromptResult> => {
    const result = await this.invoke(
      this.config.promptModules,
      "Prompt module",
      "prompts.registry.ts",
      "promptModules",
      fileName,
      className,
      methodName,
      input,
      authContext,
    );
    return result as PromptResult;
  };

  /**
   * Reads one of the plugin's own MCP resources: runs the resource method from the injected
   * resource-module registry (`config.resourceModules`, generated as `resources.registry.ts`) with
   * the URI template variables as its input. The raw return value is preserved (a string, bytes
   * or a `{ text | blob, mimeType }` object). Failures throw.
   * @param descriptor The resource.
   * @param variables The URI template variables (empty for a fixed URI).
   * @param authContext Authentication context carrier for the execute wrapper.
   */
  executeResource = async (
    descriptor: McpResourceDescriptor,
    variables: Record<string, unknown>,
    authContext?: AuthContext,
  ): Promise<unknown> => {
    return this.invoke(
      this.config.resourceModules,
      "Resource module",
      "resources.registry.ts",
      "resourceModules",
      descriptor.fileName,
      descriptor.className,
      descriptor.methodName,
      variables,
      authContext,
    );
  };

  /**
   * Resolves `registry[fileName][className][methodName]` (static first, then an instance method)
   * and calls it with the input and the call's context: through `config.execute` (the auth layer
   * builds the signed-in user's context), or with `{ authenticated: false }` without one.
   */
  private async invoke(
    registry: PluginAppConfig["toolModules"],
    label: string,
    registryFile: string,
    configKey: string,
    fileName: string,
    className: string,
    methodName: string,
    input: Record<string, unknown>,
    authContext?: AuthContext,
  ): Promise<unknown> {
    const validatedFileName = PluginApiHelper.validateFileName(fileName);
    const module = registry?.[validatedFileName] as Record<string, any> | undefined;
    if (!module) {
      throw new Error(
        `${label} not found: "${fileName}". Ensure ${registryFile} is generated and passed as config.${configKey}.`,
      );
    }
    const TargetClass = module[className];
    if (!TargetClass) {
      throw new Error(`Class not found: "${className}" in file "${fileName}.ts"`);
    }

    // Resolve static vs instance and keep the correct `this` receiver.
    let targetMethod: (input: Record<string, unknown>) => unknown;
    let thisArg: object;
    const staticMethod = TargetClass[methodName];
    if (staticMethod) {
      targetMethod = staticMethod;
      thisArg = TargetClass;
    } else {
      const instance = new TargetClass();
      targetMethod = instance[methodName];
      thisArg = instance;
    }
    if (typeof targetMethod !== "function") {
      throw new Error(
        `Method not found or not a function: "${methodName}" in class "${className}" in file "${fileName}.ts"`,
      );
    }

    const boundMethod = targetMethod.bind(thisArg) as (input: Record<string, unknown>, ...args: unknown[]) => unknown;
    if (this.config.execute) {
      return await this.config.execute<unknown>(boundMethod, input, authContext);
    }
    // Without an auth layer the method still gets a context of its own (for elicitation).
    const ctx: QuartalPluginContext = { authenticated: false };
    bindToolCallElicitation(ctx, authContext?.elicitation);
    bindToolCallFiles(ctx, authContext?.files);
    return await boundMethod(input, ctx);
  }

  /**
   * Validates a file name (letters, numbers, underscores, dashes; no extension).
   * @param fileName The file name to validate.
   */
  static validateFileName(fileName: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(fileName)) {
      throw new Error(
        `Invalid filename: ${fileName}. We only allow letters, numbers, underscores and dashes. No file extension.`,
      );
    }
    return fileName;
  }

  /**
   * Coerces a string-valued query record into typed params (numbers, booleans, null, JSON).
   * Best-effort — use POST for complex parameters.
   * @param query Query string values.
   */
  static queryToParams(query: Record<string, string>): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value === "true") params[key] = true;
      else if (value === "false") params[key] = false;
      else if (value === "null") params[key] = null;
      else if (value === "undefined") params[key] = undefined;
      else if (value !== "" && !Number.isNaN(Number(value))) params[key] = Number(value);
      else if (value.startsWith("{") || value.startsWith("[")) {
        try {
          params[key] = JSON.parse(value);
        } catch {
          params[key] = value;
        }
      } else params[key] = value;
    }
    return params;
  }

  /** Loads the generated `qrtl-plugin/` metadata into memory (also builds the Zod validators).
   * Injected build-time artifacts win per field; disk is the fallback. */
  private async prepareTools(): Promise<void> {
    const injected = this.config.artifacts;
    const hubDir = join(this.baseDir, this.qrtlPluginDir);
    const readJson = async <T>(file: string): Promise<T | undefined> => {
      const raw = await Helpers.readIfExists(join(hubDir, file));
      return raw ? JSON.parse(raw) as T : undefined;
    };

    const tools = injected?.tools ?? await readJson<{ files?: CodeFile[] }>("tools.json");
    if (!tools) {
      this.codeFiles = [];
      this.zodCreator = null;
      this.functionDefs = null;
      return;
    }
    this.codeFiles = loadCodeFiles(tools);

    this.prebuiltOpenApi = injected?.openApi ?? await readJson<Record<string, unknown>>("open-api.json") ?? null;
    this.prebuiltTypes = injected?.types ?? await readJson<unknown[]>("types.json") ?? null;
    this.prebuiltContents = injected?.contents ?? await readJson<PluginInfo>("contents.json") ?? null;
    this.prebuiltMcpTools =
      (injected?.mcpTools ?? await readJson<{ tools?: McpToolDescriptor[] }>("mcp-tools.json"))?.tools ?? null;
    this.prebuiltMcpPrompts =
      (injected?.mcpPrompts ?? await readJson<{ prompts?: McpPromptDescriptor[] }>("mcp-prompts.json"))?.prompts ?? null;
    this.prebuiltMcpResources =
      (injected?.mcpResources ?? await readJson<{ resources?: McpResourceDescriptor[] }>("mcp-resources.json"))?.resources ?? null;

    this.zodCreator = new ZodBuilder(this.codeFiles);
    this.functionDefs = this.zodCreator.getZodsForAllFunctions();
  }

  /** Merges runtime plugin metadata and auth into a pre-generated OpenAPI document. */
  private mergeRuntimeOpenApi(doc: Record<string, unknown>, serverOrigin?: string): Record<string, unknown> {
    const merged = structuredClone(doc);
    if (this.manifest) {
      merged.info = {
        ...(merged.info as Record<string, unknown> | undefined),
        ...buildOpenApiInfo(this.manifest, serverOrigin),
      };
    }

    const auth = this.config.auth;
    if (!auth?.name) return merged;
    const components = (merged.components ?? {}) as Record<string, unknown>;
    const securitySchemes = (components.securitySchemes ?? {}) as Record<string, unknown>;

    const scheme: Record<string, unknown> = { type: auth.type };
    if (auth.scheme) scheme.scheme = auth.scheme;
    if (auth.bearerFormat) scheme.bearerFormat = auth.bearerFormat;
    if (auth.flows) scheme.flows = auth.flows;
    securitySchemes[auth.name] = scheme;
    components.securitySchemes = securitySchemes;
    merged.components = components;

    const security = [{ [auth.name]: [] }];
    const paths = merged.paths as Record<string, Record<string, Record<string, unknown>>> | undefined;
    if (paths) {
      for (const pathItem of Object.values(paths)) {
        for (const operation of Object.values(pathItem)) {
          if (operation && typeof operation === "object") operation.security = security;
        }
      }
    }
    return merged;
  }
}
