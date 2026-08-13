/**
 * @quartal/plugin — The core plugin NPM package for creating Quartal plugins.
 *
 * The pure code-analysis / metadata pipeline plus the Hono runtime and Astro integration.
 * The runtime server (Astro integration + Hono app) and the `generateTools` orchestration with
 * filesystem discovery are added in later migration phases.
 * @module
 */

export { CodeFileRenderer } from "./code/CodeFileRenderer.ts";
export { buildTypeIndex } from "./code/buildTypeIndex.ts";
export {
  buildPluginArtifacts,
  prepareCodeFilesForPlugin,
  writePluginArtifacts,
  writeJsonToFile,
} from "./code/buildPluginArtifacts.ts";
export type { PluginArtifacts } from "./code/buildPluginArtifacts.ts";
export { buildMcpCatalog } from "./code/buildMcpCatalog.ts";
export { buildMcpPrompts } from "./code/buildMcpPrompts.ts";
export { buildMcpTools, makeMcpToolName } from "./code/buildMcpTools.ts";
export { buildOpenApiDocument } from "./code/buildOpenApiDocument.ts";
export { buildOpenApiTags } from "./code/buildOpenApiTags.ts";
export type { OpenApiTag } from "./code/buildOpenApiTags.ts";
export { getFunctionsWithResolvedTypes } from "./code/getFunctionsWithResolvedTypes.ts";
export { getSystemCodeFile } from "./code/getSystemCodeFile.ts";
export { loadCodeFiles } from "./code/loadCodeFiles.ts";
export {
  buildToolInputSchema,
  codeOrSystemTypeToJsonSchema,
  codePropToJsonSchema,
  codeTypeToJsonSchema,
} from "./code/jsonSchemaFromCode.ts";
export { generateTools } from "./code/generateTools.ts";
export type { GenerateToolsOptions } from "./code/generateTools.ts";
export { buildToolsRegistrySource } from "./code/buildToolsRegistry.ts";
export type { ToolsRegistryOptions } from "./code/buildToolsRegistry.ts";
export { buildPluginInfo, buildSkillSummaries } from "./hono-app/buildPluginInfo.ts";
export type { BuildPluginInfoInput } from "./hono-app/buildPluginInfo.ts";
export { discoverSkills, isValidSkillName, parseSkillFrontmatter } from "./hono-app/skillDiscovery.ts";
export { qrtlCodegenPlugin } from "./vite/qrtlCodegenPlugin.ts";
export type { QrtlCodegenPluginOptions, VitePluginLike } from "./vite/qrtlCodegenPlugin.ts";
export { ZodBuilder } from "./code/ZodBuilder.ts";
export type { FunctionZodDefinition, FunctionZodList, TypeZodMap } from "./code/ZodBuilder.ts";
export type { FunctionWithResolvedTypes } from "./code/getFunctionsWithResolvedTypes.ts";
export { Helpers } from "./helpers/Helpers.ts";
export { defineQrtlConfig } from "./model/QrtlConfig.ts";
export type { QrtlConfig } from "./model/QrtlConfig.ts";

// Cache + plugin cache helper
export { getPluginCache, MemoryCache, setPluginCache } from "./cache/PluginCache.ts";
export type { CacheKey, PluginCache } from "./cache/PluginCache.ts";

// Astro integration (also available as the `@quartal/plugin/astro` subpath)
export { createPluginMiddleware, isServerPath } from "./astro/pluginMiddleware.ts";
export type { MiddlewareOnRequest } from "./astro/pluginMiddleware.ts";
export { buildPluginMiddlewareSource, PLUGIN_MIDDLEWARE_VIRTUAL_ID, qrtlPlugin } from "./astro/integration.ts";
export type { QrtlPluginOptions } from "./astro/integration.ts";
export { clearCached, getCached } from "./hono-app/cache.ts";
export type { CacheOptions } from "./hono-app/cache.ts";

// Auth — Quartal IAM (Keycloak / OIDC JWT bearer). Salaxy auth is intentionally not ported.
export {
  getOAuthContextFromKv,
  getProtectedResourceMetadataDoc,
  getProtectedResourceMetadataUrl,
  getTokenEndpoint,
  oauthAuthMiddleware,
  resolveOAuthOptions,
  unauthorized,
} from "./oauth/oauthAuth.ts";
export type { OAuthOptions, ResolvedOAuthOptions } from "./oauth/oauthAuth.ts";

// Runtime request serving (Hono API app + MCP)
export { PluginApiHelper } from "./hono-app/PluginApiHelper.ts";
export { PluginMcpHelper } from "./hono-app/PluginMcpHelper.ts";
export { buildMcpServerImplementation } from "./hono-app/pluginIcon.ts";

// Widgets: page discovery (config-time catalog) + runtime live serving of MCP UI resources.
export {
  discoverWidgets,
  discoverWidgetsSync,
  mergeCsp,
  toWidgetCatalog,
} from "./widgets/discoverWidgets.ts";
export type { DiscoveredWidget, DiscoverWidgetsOptions, WidgetConfigEntry } from "./widgets/discoverWidgets.ts";
export {
  defaultFetchWidgetHtml,
  registerWidgetAssetRoutes,
  resolveWidgetEntries,
  rewriteWidgetHtml,
  WIDGET_ASSETS_PREFIX,
  WIDGET_MIME_TYPE,
  WIDGET_PAGES_DIR,
  withWidgetOrigin,
} from "./widgets/runtimeWidgets.ts";
export type {
  ExecuteFn,
  FetchWidgetHtml,
  McpServerOptions,
  PluginAppConfig,
  ToolModuleRegistry,
  WidgetEntry,
} from "./model/index.ts";

// App assemblers + route groups
export { getAnonApp } from "./hono-app/getAnonApp.ts";
export { getAuthApp } from "./hono-app/getAuthApp.ts";
export { registerDocsSpaRoutes } from "./hono-app/docsSpaRoutes.ts";
export { registerSkillRoutes } from "./hono-app/skillRoutes.ts";
export { registerPluginInfoRoutes } from "./hono-app/pluginInfoRoutes.ts";
export { registerPublicFolderRoutes } from "./hono-app/publicFolderRoutes.ts";
export { registerIconRoutes } from "./hono-app/iconRoutes.ts";
export { getCachedIcon } from "./hono-app/iconCache.ts";

export type {
  AuthContext,
  Avatar,
  CodeArrayType,
  CodeClass,
  CodeFile,
  CodeFunction,
  CodeOrSystemType,
  CodePropOrParam,
  CodeType,
  PluginManifest,
  McpCatalog,
  McpCatalogEntry,
  McpCatalogTool,
  McpPromptDescriptor,
  McpPromptsDocument,
  McpToolDescriptor,
  PluginPromptEntry,
  PromptArgument,
  PromptMessage,
  PromptResponse,
  PromptResult,
  QuartalPluginContext,
  SystemType,
} from "./model/index.ts";
// MCP specification types (copied into plugin-core, original names) — for authoring prompt/tool results.
export type {
  Annotations,
  AudioContent,
  BaseMetadata,
  BlobResourceContents,
  ContentBlock,
  EmbeddedResource,
  ImageContent,
  Resource,
  ResourceContents,
  ResourceLink,
  Role,
  TextContent,
  TextResourceContents,
} from "./model/index.ts";
