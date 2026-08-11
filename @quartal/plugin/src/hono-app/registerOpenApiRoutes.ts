import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";

import type { FunctionZodList } from "../code/ZodBuilder.ts";
import { coerceNumberAndBooleanObject } from "./coerceQuerySchema.ts";

export interface RegisterOpenApiRoutesOptions {
  basePath: string;
  defaultMethod: "get" | "post";
  authName?: string;
  /** When omitted, registers stub handlers that return `{}`. */
  createHandler?: (ctx: {
    fileName: string;
    className: string;
    methodName: string;
  }) => (c: unknown) => Promise<Response | unknown>;
  createValidationHook?: () => (
    result: { success: boolean; error?: unknown },
    c: { json: (body: unknown, status?: number) => Response },
  ) => Response | void;
}

function fileNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const last = normalized.split("/").pop() ?? "";
  return last.endsWith(".ts") ? last.slice(0, -3) : last;
}

/**
 * Registers OpenAPI routes for all tool functions (used by PluginApiHelper and docs generation).
 */
export function registerOpenApiRoutes(
  app: OpenAPIHono,
  defs: FunctionZodList,
  options: RegisterOpenApiRoutesOptions,
): void {
  const stubHandler = () => (c: { json: (v: unknown) => Response }) => c.json({});
  const handlerFor = options.createHandler ?? (() => stubHandler());
  const validationHook = options.createValidationHook?.();

  for (const def of defs) {
    const fileName = fileNameFromPath(def.filePath);
    const className = def.className ?? "";
    const methodName = def.fn?.name ?? "";
    const path = `${options.basePath}/${className}/${methodName}`;
    const security = options.authName ? [{ [options.authName]: [] }] : undefined;
    const operationDoc = {
      ...(className ? { tags: [className] } : {}),
      ...(def.fn?.summary ? { summary: def.fn.summary } : {}),
      description: def.fn?.description ?? "",
    };

    if (options.defaultMethod === "get") {
      const getRoute = createRoute({
        method: "get",
        path,
        ...operationDoc,
        request: {
          query: coerceNumberAndBooleanObject(def.input) as any,
        },
        responses: {
          200: {
            content: { "application/json": { schema: def.returns } },
            description: def.fn?.returns?.description ?? "Success response (GET)",
          },
        },
        security,
      });

      app.openapi(
        getRoute,
        handlerFor({ fileName, className, methodName }) as any,
        validationHook as any,
      );
    } else {
      const postRoute = createRoute({
        method: "post",
        path,
        ...operationDoc,
        request: {
          body: {
            content: { "application/json": { schema: def.input } },
          },
        },
        responses: {
          200: {
            content: { "application/json": { schema: def.returns } },
            description: def.fn?.returns?.description ?? "Success response (POST)",
          },
        },
        security,
      });

      app.openapi(
        postRoute,
        handlerFor({ fileName, className, methodName }) as any,
        validationHook as any,
      );
    }
  }
}

/** Default validation hook for failed request validation. */
export function defaultValidationHook(): (
  result: { success: boolean; error?: unknown },
  c: { json: (body: unknown, status?: number) => Response },
) => Response | void {
  return (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Validation failed", details: z.treeifyError(result.error as z.ZodError) },
        422,
      );
    }
  };
}
