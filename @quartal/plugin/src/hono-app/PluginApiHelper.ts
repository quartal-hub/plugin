import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

import { buildMcpCatalog } from "../code/buildMcpCatalog.ts";
import { buildMcpTools } from "../code/buildMcpTools.ts";
import { buildOpenApiTags } from "../code/buildOpenApiTags.ts";
import { loadCodeFiles } from "../code/loadCodeFiles.ts";
import { type FunctionZodDefinition, type FunctionZodList, ZodBuilder } from "../code/ZodBuilder.ts";
import { Helpers } from "../helpers/Helpers.ts";
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
  McpToolDescriptor,
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
  private prebuiltMcpPrompts: McpPromptDescriptor[] | null = null;
  private widgetEntries: WidgetCatalogEntry[] = [];
  private baseDir: string;
  /** Directory (under {@link baseDir}) holding the generated artifacts. Default `"qrtl-plugin"`. */
  public readonly qrtlPluginDir: string;

  constructor(public readonly basePath: string = "/api", private readonly config: PluginAppConfig) {
    this.baseDir = config.pluginRootFolder ?? process.cwd();
    this.qrtlPluginDir = config.qrtlPluginDir ?? "qrtl-plugin";
  }

  /** Default HTTP method for the API routes (GET or POST) if not specified per function. */
  public defaultMethod: "get" | "post" = "post";

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

  /** Loads the manifest, README and the generated `qrtl-plugin/` metadata. */
  public async init(): Promise<void> {
    this.manifest = await Helpers.getPluginManifest(this.baseDir);
    this.readmeContent = await Helpers.readIfExists(join(this.baseDir, "README.md")) ?? "No README.md found in the plugin.";
    await this.prepareTools();
  }

  /** URL of the OpenAPI JSON document. */
  public get openApiUrl(): string {
    return `/open-api.json`;
  }

  /** In-memory MCP catalog derived from code files + configured widgets (feeds `contents.json`). */
  public getMcpCatalog(): McpCatalog {
    return buildMcpCatalog(this.codeFiles, this.widgetEntries, this.mcpPrompts);
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
    const mcpTools = this.prebuiltMcpTools ?? buildMcpTools(this.codeFiles);
    const skills = await buildSkillSummaries(this.baseDir, this.manifest!.name);
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
      defaultMethod: this.defaultMethod,
      hasReadme: !!this.readmeContent && this.readmeContent !== "No README.md found in the plugin.",
      origin,
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
      allowHeaders: ["Content-Type", "Authorization", "mcp-protocol-version", "mcp-session-id"],
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
      basePath: this.basePath,
      defaultMethod: this.defaultMethod,
      authName: this.config.auth?.name,
      createValidationHook: defaultValidationHook,
      createHandler: ({ fileName, className, methodName }) => async (c: any) => {
        const params = (this.defaultMethod === "get" ? (c.req as any).valid("query") : (c.req as any).valid("json")) as Record<
          string,
          unknown
        >;
        const result = await this.execute(fileName, className, methodName, params, {
          headers: { Authorization: c.req.header("Authorization") ?? "" },
        });

        if ("error" in result) {
          if (result.error === "Validation failed") return c.json(result, 422);
          return c.json(result, 500);
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
   * and errors thrown by the tool method alike. The MCP `tools/call` handler uses this directly so
   * it can report execution errors per the MCP spec (`isError: true`).
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
    const validatedFileName = PluginApiHelper.validateFileName(fileName);
    const module = this.config.toolModules?.[validatedFileName] as Record<string, any> | undefined;
    if (!module) {
      throw new Error(
        `Tool module not found: "${fileName}". Ensure tools.registry.ts is generated and passed as config.toolModules.`,
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

    const boundMethod = targetMethod.bind(thisArg) as (input: Record<string, unknown>) => unknown;
    let result: unknown;
    if (this.config.execute) {
      result = await this.config.execute<unknown>(boundMethod, input, authContext);
    } else {
      result = await boundMethod(input);
    }

    const isObject = typeof result === "object" && result !== null && !Array.isArray(result);
    return isObject ? (result as Record<string, unknown>) : { value: result ?? null };
  };

  /**
   * Executes a class method like {@link executeStrict}, but wraps failures as an `{ error }` object
   * (the REST API contract). `HTTPException`s pass through so auth failures keep their HTTP
   * semantics (e.g. 401 + WWW-Authenticate).
   * @param fileName File name without extension (letters, numbers, underscores, dashes).
   * @param className Class name within the file.
   * @param methodName Method name (static first, then instance).
   * @param input Validated input parameters.
   * @param authContext Authentication context carrier for the execute wrapper.
   * @returns Always an object; a non-object result is wrapped as `{ value }`.
   */
  execute: ExecuteFn = async (
    fileName: string,
    className: string,
    methodName: string,
    input: Record<string, unknown>,
    authContext?: AuthContext,
  ): Promise<Record<string, unknown>> => {
    try {
      return await this.executeStrict(fileName, className, methodName, input, authContext);
    } catch (error: unknown) {
      if (error instanceof HTTPException) throw error;
      return { error: error instanceof Error ? error.message : "Unknown error" };
    }
  };

  /**
   * Executes a prompt function, resolving the class from the injected prompt-module registry
   * (`config.promptModules`, generated as `prompts.registry.ts`). Unlike {@link execute}, the raw
   * return value is preserved (a `string` or a `PromptResponse`) and failures throw — the MCP
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
    const validatedFileName = PluginApiHelper.validateFileName(fileName);
    const module = this.config.promptModules?.[validatedFileName] as Record<string, any> | undefined;
    if (!module) {
      throw new Error(
        `Prompt module not found: "${fileName}". Ensure prompts.registry.ts is generated and passed as config.promptModules.`,
      );
    }
    const TargetClass = module[className];
    if (!TargetClass) {
      throw new Error(`Class not found: "${className}" in file "${fileName}.ts"`);
    }

    // Resolve static vs instance and keep the correct `this` receiver (same rules as tools).
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
      throw new Error(`Method not found or not a function: "${methodName}" in class "${className}" in file "${fileName}.ts"`);
    }

    const boundMethod = targetMethod.bind(thisArg) as (input: Record<string, unknown>) => unknown;
    const result = this.config.execute
      ? await this.config.execute<unknown>(boundMethod, input, authContext)
      : await boundMethod(input);
    return result as PromptResult;
  };

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

  /** Loads the generated `qrtl-plugin/` metadata into memory (also builds the Zod validators). */
  private async prepareTools(): Promise<void> {
    const hubDir = join(this.baseDir, this.qrtlPluginDir);
    const codeJson = await Helpers.readIfExists(join(hubDir, "tools.json"));
    if (!codeJson) {
      this.codeFiles = [];
      this.zodCreator = null;
      this.functionDefs = null;
      return;
    }

    const parsed = JSON.parse(codeJson) as { files?: CodeFile[] };
    this.codeFiles = loadCodeFiles(parsed);

    const openApiJson = await Helpers.readIfExists(join(hubDir, "open-api.json"));
    this.prebuiltOpenApi = openApiJson ? JSON.parse(openApiJson) as Record<string, unknown> : null;

    const typesJson = await Helpers.readIfExists(join(hubDir, "types.json"));
    this.prebuiltTypes = typesJson ? JSON.parse(typesJson) as unknown[] : null;

    const contentsJson = await Helpers.readIfExists(join(hubDir, "contents.json"));
    this.prebuiltContents = contentsJson ? JSON.parse(contentsJson) as PluginInfo : null;

    const mcpToolsJson = await Helpers.readIfExists(join(hubDir, "mcp-tools.json"));
    this.prebuiltMcpTools = mcpToolsJson ? (JSON.parse(mcpToolsJson) as { tools?: McpToolDescriptor[] }).tools ?? null : null;

    const mcpPromptsJson = await Helpers.readIfExists(join(hubDir, "mcp-prompts.json"));
    this.prebuiltMcpPrompts = mcpPromptsJson
      ? (JSON.parse(mcpPromptsJson) as { prompts?: McpPromptDescriptor[] }).prompts ?? null
      : null;

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
