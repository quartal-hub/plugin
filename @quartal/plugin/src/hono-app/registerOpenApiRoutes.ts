import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";

import type { FunctionZodDefinition, FunctionZodList } from "../code/ZodBuilder.ts";
import { restRouteKey } from "../code/resolveRestRoutes.ts";
import type { RestRoute } from "../model/index.ts";

/** What a route handler receives about the operation it serves. */
export interface OpenApiRouteContext {
  fileName: string;
  className: string;
  methodName: string;
  /** The resolved route: method, path, which input properties are path parameters and where the rest travel. */
  route: RestRoute;
}

export interface RegisterOpenApiRoutesOptions {
  /** Resolved routes keyed by `Class.method` (see `resolveRestRoutes`). Every definition must have one. */
  routes: Map<string, RestRoute>;
  authName?: string;
  /** When omitted, registers stub handlers that return `{}`. */
  createHandler?: (ctx: OpenApiRouteContext) => (c: unknown) => Promise<Response | unknown>;
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
 * The `request` block of a route: path parameters and the query string come from the text-accepting
 * input schema (they arrive as strings), the JSON body from the plain one; the path parameters are
 * left out of both.
 */
function requestSchemas(def: FunctionZodDefinition, route: RestRoute): Record<string, unknown> {
  const mask = Object.fromEntries(route.pathParams.map((name) => [name, true as const]));
  const withoutPathParams = (schema: z.ZodTypeAny): z.ZodTypeAny =>
    route.pathParams.length && schema instanceof z.ZodObject ? schema.omit(mask) : schema;
  const request: Record<string, unknown> = {};
  if (route.pathParams.length && def.inputFromText instanceof z.ZodObject) {
    request.params = def.inputFromText.pick(mask);
  }
  if (route.inputIn === "query") {
    request.query = withoutPathParams(def.inputFromText);
  } else if (route.inputIn === "body") {
    request.body = { content: { "application/json": { schema: withoutPathParams(def.input) } } };
  }
  return request;
}

/**
 * Registers one OpenAPI route per tool function at its resolved REST route (used by
 * PluginApiHelper and docs generation). Routes with fewer path parameters are registered first so
 * a literal segment wins over a `{param}` at the same position.
 * @param app The OpenAPIHono app to register on.
 * @param defs Zod definitions of every tool function.
 * @param options Routes, auth scheme name and handler factories.
 */
export function registerOpenApiRoutes(
  app: OpenAPIHono,
  defs: FunctionZodList,
  options: RegisterOpenApiRoutesOptions,
): void {
  const stubHandler = () => (c: { json: (v: unknown) => Response }) => c.json({});
  const handlerFor = options.createHandler ?? (() => stubHandler());
  const validationHook = options.createValidationHook?.();

  const resolved = defs.map((def) => {
    const className = def.className ?? "";
    const methodName = def.fn?.name ?? "";
    const route = options.routes.get(restRouteKey(className, methodName));
    if (!route) throw new Error(`No REST route resolved for ${className}.${methodName}`);
    return { def, className, methodName, route };
  });
  resolved.sort((a, b) => a.route.pathParams.length - b.route.pathParams.length);

  for (const { def, className, methodName, route } of resolved) {
    const fileName = fileNameFromPath(def.filePath);
    const security = options.authName ? [{ [options.authName]: [] }] : undefined;
    const openApiRoute = createRoute({
      method: route.method.toLowerCase() as "get" | "post" | "put" | "delete",
      path: route.path,
      ...(className ? { tags: [className] } : {}),
      ...(def.fn?.summary ? { summary: def.fn.summary } : {}),
      description: def.fn?.description ?? "",
      request: requestSchemas(def, route) as never,
      responses: {
        200: {
          content: { "application/json": { schema: def.returns } },
          description: def.fn?.returns?.description ?? `Success response (${route.method})`,
        },
      },
      security,
    });

    app.openapi(
      openApiRoute,
      handlerFor({ fileName, className, methodName, route }) as never,
      validationHook as never,
    );
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
