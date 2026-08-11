import { OpenAPIHono } from "@hono/zod-openapi";

import type { CodeFile } from "../model/index.ts";
import type { PluginManifest } from "../model/index.ts";
import { registerOpenApiRoutes } from "../hono-app/registerOpenApiRoutes.ts";
import { buildOpenApiInfo } from "../hono-app/pluginMetadata.ts";
import { buildOpenApiTags } from "./buildOpenApiTags.ts";
import { ZodBuilder } from "./ZodBuilder.ts";

/**
 * Builds a complete OpenAPI 3.0 document from code files (for `qrtl-plugin/open-api.json`).
 * Auth security schemes are omitted; the runtime may merge them when serving.
 * @param codeFiles Analyzed code files containing API tool classes.
 * @param manifest Plugin manifest metadata.
 * @param options OpenAPI route generation options.
 */
export function buildOpenApiDocument(
  codeFiles: CodeFile[],
  manifest: PluginManifest,
  options?: { basePath?: string; defaultMethod?: "get" | "post" },
): Record<string, unknown> {
  const basePath = options?.basePath ?? "/api";
  const defaultMethod = options?.defaultMethod ?? "post";

  const zodBuilder = new ZodBuilder(codeFiles);
  const defs = zodBuilder.getZodsForAllFunctions();

  const app = new OpenAPIHono();
  registerOpenApiRoutes(app, defs, { basePath, defaultMethod });

  return app.getOpenAPIDocument({
    openapi: "3.0.0",
    info: buildOpenApiInfo(manifest) as { version: string; title: string; description: string },
    tags: buildOpenApiTags(codeFiles),
  }) as unknown as Record<string, unknown>;
}
