import type { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { OpenAPIHono } from "@hono/zod-openapi";

import { Helpers } from "../helpers/Helpers.ts";
import { PluginApiHelper } from "./PluginApiHelper.ts";
import { PluginMcpHelper } from "./PluginMcpHelper.ts";
import type { AuthContext, PluginAppConfig, QuartalPluginContext } from "../model/index.ts";
import { registerSkillRoutes } from "./skillRoutes.ts";
import { registerAgentRoutes } from "../agents/agentRoutes.ts";
import { registerPluginInfoRoutes } from "./pluginInfoRoutes.ts";
import { registerDocsSpaRoutes } from "./docsSpaRoutes.ts";
import { registerPublicFolderRoutes } from "./publicFolderRoutes.ts";
import { buildMcpServerImplementation } from "./pluginIcon.ts";
import { mcpServerDisplayName } from "./pluginMetadata.ts";
import { registerWidgetAssetRoutes, resolveWidgetEntries } from "../widgets/runtimeWidgets.ts";
import {
  getOAuthContextFromKv,
  getProtectedResourceMetadataDoc,
  getProtectedResourceMetadataUrl,
  oauthAuthMiddleware,
  type OAuthOptions,
  type QuartalAuthMode,
  type ResolvedOAuthOptions,
  resolveOAuthOptions,
  unauthorized,
} from "../oauth/oauthAuth.ts";
import { registerOAuthLoginRoutes } from "./oauthLoginRoutes.ts";

/** Maps a qrtl.config `auth` value to the OAuth default-resolution mode. */
function toAuthMode(auth: string | undefined): QuartalAuthMode {
  return auth === "custom" ? "custom" : "quartal-hub";
}

/**
 * Returns a Hono app with OAuth2 / OIDC JWT bearer authentication. The qrtl.config `auth` mode
 * picks the defaults: `"quartal-hub"` (Quartal Hub test environment, zero-config) or `"custom"`
 * (own OAuth2/OIDC server via `OAUTH_*` env vars).
 *
 * The middleware verifies incoming JWTs against the issuer's JWKS (discovered via
 * `${issuer}/.well-known/openid-configuration` or supplied directly) and exposes the resulting
 * QuartalPluginContext on `c.var.context`. Verified contexts are cached via the pluggable {@link PluginCache}.
 * @param config Optional app configuration.
 * @param oauth Optional OAuth options; explicit fields win over mode defaults and env vars.
 */
export async function getAuthApp(config?: PluginAppConfig, oauth?: OAuthOptions): Promise<Hono> {
  config = config ?? {};
  // The baked build-time root may not exist on the running host (serverless bundlers relocate the
  // app); resolve it once here so every route below reads from a directory that actually exists.
  config.pluginRootFolder = Helpers.resolvePluginRoot(config.pluginRootFolder);
  // `qrtl.config` authors both the `mcp` options (server name, multi-server map) and the auth
  // mode; direct callers (tests, non-Astro hosts) may pass `mcp` / `oauth` explicitly instead.
  // An injected artifacts snapshot is authoritative — with one present, `qrtl.config` is never
  // loaded from disk.
  const artifacts = config.artifacts;
  const qrtlConfig = artifacts ? undefined : await Helpers.loadQrtlConfig(config.pluginRootFolder);
  if (config.mcp === undefined) {
    config.mcp = artifacts ? artifacts.mcp : qrtlConfig?.mcp;
  }
  const mode = toAuthMode(artifacts ? artifacts.auth : qrtlConfig?.auth);
  const manifest = artifacts?.manifest ?? await Helpers.getPluginManifest(config.pluginRootFolder);
  let resolved: ResolvedOAuthOptions | undefined;

  if (!config.auth) {
    resolved = resolveOAuthOptions(oauth, mode);
    // Plain HTTP bearer: the docs site obtains the token through the /oauth/login flow (the same
    // CIMD method MCP clients use) and injects it into Swagger's requests.
    config.auth = {
      name: "bearerAuth",
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      middleware: oauthAuthMiddleware(oauth, mode),
    };
  }

  config.execute = async <T>(
    targetMethod: (input: Record<string, unknown>, ...args: unknown[]) => T,
    input: Record<string, unknown>,
    authContext?: AuthContext,
  ): Promise<T> => {
    const ctx = await getOAuthContextFromKv(authContext);
    if (!ctx) {
      throw new HTTPException(401, {
        res: unauthorized("missing verified context", {
          resourceMetadataUrl: resolved ? getProtectedResourceMetadataUrl(resolved) : undefined,
          scopes: resolved?.scopes,
        }),
      });
    }
    return await (targetMethod as (input: Record<string, unknown>, ctx: QuartalPluginContext) => T)(input, ctx);
  };

  const helper = new PluginApiHelper("/api", config);
  await helper.init();
  const app: OpenAPIHono = helper.getApiApp();

  // OAuth Protected Resource Metadata (RFC 9728) — unauthenticated so MCP clients can discover the
  // authorization server after a 401. Both root and path-aware forms are mounted (MCP 2025-11-25).
  // Built per request: when no fixed `resource` is configured it derives from the request origin.
  if (resolved) {
    const oauthResolved = resolved;
    const metadata = (url: string) => getProtectedResourceMetadataDoc(oauthResolved, url);
    app.get("/.well-known/oauth-protected-resource", (c) => c.json(metadata(c.req.url)));
    app.get("/.well-known/oauth-protected-resource/:path{.+}", (c) => c.json(metadata(c.req.url)));
    // Browser login for the docs site (CIMD client metadata + /oauth/login + /oauth/callback).
    registerOAuthLoginRoutes(app as Hono, oauthResolved, manifest.title ?? manifest.name);
  }

  const mcpOptions = typeof config.mcp === "object" ? config.mcp : undefined;
  registerDocsSpaRoutes(app as Hono, { skinUrl: helper.manifest!.style.skin, docsWebUrl: config.docsWebUrl });
  registerSkillRoutes(app as Hono, config.pluginRootFolder, helper.manifest!);
  registerAgentRoutes(app as Hono, config.pluginRootFolder, helper.manifest!, {
    pluginTools: helper.getMcpCatalog().tools.map((t) => t.id),
    pluginServer: mcpServerDisplayName(helper.manifest!.name),
  });
  // Widget pages + assets stay unauthenticated: the sandboxed widget iframe carries no credentials
  // (auth middleware is scoped to /api/* and /mcp, not to /widget-assets).
  const widgets = config.widgetResources?.length
    ? config.widgetResources
    : config.artifacts?.widgetResources ?? await resolveWidgetEntries(config);
  helper.setWidgetCatalog(widgets.map((w) => ({ toolId: w.toolId, name: w.name })));
  registerPluginInfoRoutes(app as Hono, helper, {
    mcpOptions,
    pluginRootFolder: config.pluginRootFolder,
    getMcpServer: (origin) => buildMcpServerImplementation(helper.manifest!, mcpOptions, origin),
  });
  if (widgets.length > 0 && config.mcp !== false) registerWidgetAssetRoutes(app as Hono);
  await PluginMcpHelper.applyToApp(app as Hono, helper, config, widgets);
  registerPublicFolderRoutes(app as Hono, config.pluginRootFolder);

  return app as Hono;
}
