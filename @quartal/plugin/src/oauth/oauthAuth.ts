import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

import { getPluginCache } from "../cache/PluginCache.ts";
import type { AuthContext, Avatar, QuartalPluginContext } from "../model/index.ts";

/**
 * Options for generic OAuth / OIDC JWT bearer-token authentication.
 *
 * Any option left undefined falls back to an environment variable (OAUTH_ISSUER, OAUTH_AUDIENCE,
 * OAUTH_JWKS_URI, OAUTH_RESOURCE, OAUTH_SCOPE). `issuer` and at least one of `audience`/`resource`
 * are required. `jwksUri` is optional: when missing, the URI is discovered from
 * `${issuer}/.well-known/openid-configuration`.
 */
export interface OAuthOptions {
  /** Expected `iss` claim and base URL for OIDC discovery. Defaults to env `OAUTH_ISSUER`. */
  issuer?: string;

  /** Expected `aud` claim (or list of acceptable audiences). Defaults to env `OAUTH_AUDIENCE`, or `resource` if set. */
  audience?: string | string[];

  /**
   * Canonical URI of this MCP / API resource server (e.g. `https://hub.example.com`).
   * Used as the default `audience` and as the `resource` field in the OAuth Protected Resource
   * Metadata document (RFC 9728), and to construct the absolute `resource_metadata` URL in
   * `WWW-Authenticate` headers. Required for full Claude / MCP-spec compatibility.
   * Defaults to env `OAUTH_RESOURCE`.
   */
  resource?: string;

  /**
   * Scope(s) this resource server requires for access. Surfaced in the `scope=` parameter of the
   * `WWW-Authenticate` 401 challenge (MCP 2025-11-25 SHOULD) and in `scopes_supported` in the
   * Protected Resource Metadata document. Defaults to env `OAUTH_SCOPE` (space-separated).
   */
  scope?: string | string[];

  /**
   * Additional OIDC scopes always merged alongside `scope`. Drives user-info claims for
   * CIMD-derived clients (e.g. Claude, MCPJam) which only get the scopes they explicitly request
   * via `scope=` — pre-registered clients pick up Default Client Scopes per-client without
   * needing this. Defaults to `"profile email"`. Set to `[]` to opt out entirely.
   *
   * Two scopes are intentionally NOT in the default:
   *
   * - `openid`: Keycloak's CIMD executor demands explicit consent for every requested scope,
   *   and `openid` isn't a UI-configurable scope in Keycloak (it's a hardcoded OIDC trigger).
   *   It can never be consented to → token exchange fails. We don't need an OIDC id_token or
   *   `/userinfo` round-trip for MCP — profile/email mappers add user-info claims directly to
   *   the access token.
   *
   * - `organization` (and any other Realm Default scope): Keycloak's CIMD impl has a bug where
   *   *explicitly* requesting a scope that's also a Realm Default Client Scope causes the
   *   token-exchange consent check to fail with `not_allowed / Client no longer has requested
   *   consent from user`. The scope is still applied automatically via the realm Default
   *   mechanism, so the corresponding mapper still fires and the claim reaches the token —
   *   we just must not name it explicitly. Add it to your realm's Default Client Scopes
   *   (or assign it on the persistent CIMD client) instead of including it here.
   *
   * Bug reproducible against Keycloak 26 with `--features=cimd`; track for graduation /
   * fix in upstream Keycloak before re-considering.
   */
  additionalScopes?: string | string[];

  /** Optional human-readable docs URL for this resource, advertised as `resource_documentation` in the metadata. */
  documentationUrl?: string;

  /** Explicit JWKS URI. If unset, discovered from `${issuer}/.well-known/openid-configuration`. Defaults to env `OAUTH_JWKS_URI`. */
  jwksUri?: string;

  /** Explicit token endpoint URL. If unset, discovered from OIDC config. Defaults to env `OAUTH_TOKEN_URL`. */
  tokenUrl?: string;

  /** OAuth client_id to pre-fill in the Swagger UI Authorize dialog. Defaults to env `OAUTH_CLIENT_ID`. */
  clientId?: string;

  /** Allowed JWS algorithms. Defaults to `["RS256", "ES256"]`. */
  algorithms?: string[];

  /** Max cache TTL in milliseconds for a verified context in Deno KV. Clamped to token `exp`. Defaults to 1 hour. */
  cacheTtlMs?: number;

  /** Custom mapping from JWT claims to QuartalPluginContext. Defaults to sub→uid, email→email etc. */
  claimsToContext?: (claims: JWTPayload, token: string) => QuartalPluginContext;
}

/** OAuthOptions after env-var/default fallback resolution — every field needed at runtime is filled. */
export interface ResolvedOAuthOptions {
  /** Authorization-server issuer URL. */
  issuer: string;
  /** Expected `aud` claim value(s) on incoming access tokens. */
  audience: string | string[];
  /** Canonical URI of this protected resource (per RFC 8707); also published in metadata. */
  resource?: string;
  /** Scopes advertised in `WWW-Authenticate` and `scopes_supported` (per-service + OIDC user-info). */
  scopes: string[];
  /** URL of human-readable docs for this resource, surfaced in protected-resource metadata. */
  documentationUrl?: string;
  /** JWKS endpoint URL; if omitted, discovered from `${issuer}/.well-known/openid-configuration`. */
  jwksUri?: string;
  /** Allowed JWT signing algorithms (default: `["RS256", "ES256"]`). */
  algorithms: string[];
  /** Max cache TTL in milliseconds for a verified context in Deno KV. */
  cacheTtlMs: number;
  /** Mapper from JWT claims to the QuartalPluginContext stored on `c.var.context`. */
  claimsToContext: (claims: JWTPayload, token: string) => QuartalPluginContext;
}

const DEFAULT_CACHE_TTL_MS = 3_600_000;
const DEFAULT_ALGORITHMS = ["RS256", "ES256"];

function normalizeScopes(scope: string | string[] | undefined): string[] {
  if (!scope) return [];
  if (Array.isArray(scope)) return scope.filter((s) => s.trim().length > 0);
  return scope.split(/\s+/).filter((s) => s.length > 0);
}

// Quartal-specific dev defaults; will be replaced once issuer/host are renamed.
const DEFAULT_DEV_ISSUER = "https://iam2026.test.qrtl.com/realms/salaxy-test";
const DEFAULT_HOST_SUFFIX = "quartal.deno.net";

/**
 * Scopes always merged with the per-service scope so CIMD-derived clients (e.g. Claude, MCPJam)
 * get the standard OIDC user-info claims `defaultClaimsToContext` expects. Pre-registered
 * clients (Swagger, ChatGPT GPTs) pick these up via Default Client Scopes per-client; CIMD
 * clients have no such hook.
 *
 * `openid` and `organization` are intentionally excluded — see the JSDoc on
 * `OAuthOptions.additionalScopes` for the reasoning.
 */
const DEFAULT_ADDITIONAL_SCOPES = ["profile", "email"];

/** Strips the `@org/` prefix from a JSR/npm-style plugin name (e.g. `@samples/auth-agent` → `auth-agent`). */
function stripOrgPrefix(pluginName: string | undefined): string | undefined {
  if (!pluginName) return undefined;
  return pluginName.replace(/^@[^/]+\//, "");
}

/**
 * Resolves an `OAuthOptions` (possibly empty) into a fully-populated `ResolvedOAuthOptions`
 * by layering env vars (`OAUTH_*`) and Quartal-specific defaults derived from `pluginName`
 * over the caller-supplied values. Throws if no audience can be determined.
 * @param opts Caller-supplied OAuth overrides.
 * @param pluginName Plugin name used to derive default resource and scope values.
 */
export function resolveOAuthOptions(opts?: OAuthOptions, pluginName?: string): ResolvedOAuthOptions {
  const envIssuer = process.env.OAUTH_ISSUER || undefined;
  const envAudience = process.env.OAUTH_AUDIENCE || undefined;
  const envJwksUri = process.env.OAUTH_JWKS_URI || undefined;
  const envResource = process.env.OAUTH_RESOURCE || undefined;
  const envScope = process.env.OAUTH_SCOPE || undefined;

  // Convention: a microservice's resource URI and Keycloak scope name both derive from the
  // unscoped plugin name (e.g. `@samples/auth-agent` → `auth-agent`). Used only as a
  // fallback — explicit `opts` and env vars override.
  const appName = stripOrgPrefix(pluginName);
  const defaultResource = appName ? `https://${appName}.${DEFAULT_HOST_SUFFIX}` : undefined;

  const issuer = opts?.issuer ?? envIssuer ?? DEFAULT_DEV_ISSUER;
  const resource = opts?.resource ?? envResource ?? defaultResource;
  // Per RFC 8707 the audience matches the canonical resource URI; fall back to `resource` when audience is not set.
  const audience = opts?.audience ?? envAudience ?? resource;
  if (!audience) {
    throw new Error(
      "OAuth audience is required for token validation per RFC 8707 / MCP spec. " +
        "Set OAUTH_AUDIENCE or OAUTH_RESOURCE, or pass `audience`/`resource` in OAuthOptions, " +
        "or supply a `pluginName` so the framework can derive a default resource.",
    );
  }
  const baseScopes = normalizeScopes(opts?.scope ?? envScope ?? appName);
  const additionalScopes = opts?.additionalScopes !== undefined ? normalizeScopes(opts.additionalScopes) : DEFAULT_ADDITIONAL_SCOPES;
  const scopes = Array.from(new Set([...baseScopes, ...additionalScopes]));
  return {
    issuer,
    audience,
    resource,
    scopes,
    documentationUrl: opts?.documentationUrl,
    jwksUri: opts?.jwksUri ?? envJwksUri,
    algorithms: opts?.algorithms ?? DEFAULT_ALGORITHMS,
    cacheTtlMs: opts?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
    claimsToContext: opts?.claimsToContext ?? defaultClaimsToContext,
  };
}

/**
 * Returns the absolute URL for the OAuth Protected Resource Metadata document (RFC 9728).
 * Prefers the configured `resource` URI; falls back to deriving from the request URL.
 * Returns undefined if neither yields a valid absolute URL.
 * @param resolved Resolved OAuth options containing the resource URI.
 * @param requestUrl Current request URL used as a fallback resource candidate.
 */
export function getProtectedResourceMetadataUrl(
  resolved: Pick<ResolvedOAuthOptions, "resource">,
  requestUrl?: string,
): string | undefined {
  for (const candidate of [resolved.resource, requestUrl]) {
    if (!candidate) continue;
    try {
      return `${new URL(candidate).origin}/.well-known/oauth-protected-resource`;
    } catch {
      // try next candidate
    }
  }
  return undefined;
}

/**
 * Returns the OAuth Protected Resource Metadata document body (RFC 9728).
 * Mount this at `/.well-known/oauth-protected-resource` so MCP clients (incl. Claude) can
 * discover the authorization server after a 401 response.
 * @param resolved Resolved OAuth options for the protected resource.
 */
export function getProtectedResourceMetadataDoc(
  resolved: ResolvedOAuthOptions,
): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    resource: resolved.resource,
    authorization_servers: [resolved.issuer],
    bearer_methods_supported: ["header"],
  };
  if (resolved.scopes.length > 0) doc.scopes_supported = resolved.scopes;
  if (resolved.documentationUrl) doc.resource_documentation = resolved.documentationUrl;
  return doc;
}

/**
 * Builds a 401 Response with a `WWW-Authenticate: Bearer` challenge per RFC 9728 §5.1
 * and MCP 2025-11-25 §"Protected Resource Metadata Discovery Requirements".
 *
 * The `source` identifier is included in the JSON error body to help locate the failing
 * site in the codebase (e.g. `"missing token"`, `"KV in getAuthApp"`).
 *
 * When `scopes` are supplied, the `scope=` parameter is appended to the challenge so clients
 * can request the right scope on the authorization round-trip.
 * @param source Short identifier describing why authorization failed.
 * @param opts Optional challenge parameters (resource metadata URL and scopes).
 */
export function unauthorized(
  source: string,
  opts?: { resourceMetadataUrl?: string; scopes?: string[] },
): Response {
  const params: string[] = [];
  if (opts?.resourceMetadataUrl) params.push(`resource_metadata="${opts.resourceMetadataUrl}"`);
  if (opts?.scopes && opts.scopes.length > 0) params.push(`scope="${opts.scopes.join(" ")}"`);
  const challenge = params.length > 0 ? `Bearer ${params.join(", ")}` : `Bearer`;
  return new Response(
    JSON.stringify({ error: `Unauthorized (${source})` }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": challenge,
      },
    },
  );
}

interface OidcConfig {
  jwks_uri?: string;
  token_endpoint?: string;
  authorization_endpoint?: string;
}

const oidcConfigCache = new Map<string, Promise<OidcConfig>>();

async function getOidcConfig(issuer: string): Promise<OidcConfig> {
  const cached = oidcConfigCache.get(issuer);
  if (cached) return await cached;
  const fetchPromise = (async (): Promise<OidcConfig> => {
    const url = issuer.replace(/\/$/, "") + "/.well-known/openid-configuration";
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `OIDC discovery failed for ${issuer}: ${res.status} ${res.statusText}`,
      );
    }
    return await res.json() as OidcConfig;
  })();
  oidcConfigCache.set(issuer, fetchPromise);
  try {
    return await fetchPromise;
  } catch (err) {
    oidcConfigCache.delete(issuer);
    throw err;
  }
}

async function getJwksUri(opts: ResolvedOAuthOptions): Promise<string> {
  if (opts.jwksUri) return opts.jwksUri;
  const config = await getOidcConfig(opts.issuer);
  if (!config.jwks_uri) {
    throw new Error(`OIDC discovery did not return jwks_uri for ${opts.issuer}`);
  }
  return config.jwks_uri;
}

/**
 * Resolves the OAuth2 token endpoint URL: explicit `tokenUrl` if provided,
 * otherwise discovered from the issuer's OIDC config (`token_endpoint`).
 * Falls back to env `OAUTH_TOKEN_URL` before discovery.
 * @param opts Issuer and optional explicit token endpoint override.
 */
export async function getTokenEndpoint(
  opts: { issuer: string; tokenUrl?: string },
): Promise<string> {
  const explicit = opts.tokenUrl ?? process.env.OAUTH_TOKEN_URL ?? undefined;
  if (explicit) return explicit;
  const config = await getOidcConfig(opts.issuer);
  if (!config.token_endpoint) {
    throw new Error(`OIDC discovery did not return token_endpoint for ${opts.issuer}`);
  }
  return config.token_endpoint;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function getJwks(opts: ResolvedOAuthOptions): Promise<ReturnType<typeof createRemoteJWKSet>> {
  const uri = await getJwksUri(opts);
  let jwks = jwksCache.get(uri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(uri));
    jwksCache.set(uri, jwks);
  }
  return jwks;
}

function defaultClaimsToContext(claims: JWTPayload, token: string): QuartalPluginContext {
  const displayName = (claims.name || claims.preferred_username || claims.sub) as string || undefined;
  const avatar: Avatar = {
    color: claims.avatar_color as string || "gray",
    initials: claims.avatar_initials as string || displayName?.[0].toUpperCase() || "?",
    displayName: displayName || "Unknown User",
    url: claims.picture as string | undefined,
    firstName: claims.given_name as string | undefined,
    lastName: claims.family_name as string | undefined,
  };
  return {
    authenticated: true,
    uid: claims.sub,
    email: (claims.email || claims.email_verified) as string | undefined,
    orgs: claims.organization as Record<string, unknown> || {},
    token,
    avatar,
  };
}

function getTokenFromAuthHeader(authHeader: string | undefined): string | undefined {
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) return undefined;
  return authHeader.slice(7).trim() || undefined;
}

function kvKey(token: string): [string, string] {
  return ["oauth_ctx", token];
}

function computeExpireIn(claims: JWTPayload, cacheTtlMs: number): number {
  if (typeof claims.exp === "number") {
    const expMs = claims.exp * 1000 - Date.now();
    // Floor at 1s so a successful verification always produces a cache entry the
    // MCP execute path can read (it has no access to Hono context — KV is the side-channel).
    return Math.max(1_000, Math.min(cacheTtlMs, expMs));
  }
  return cacheTtlMs;
}

/**
 * Creates a Hono middleware that verifies OAuth JWT bearer tokens using the issuer's JWKS.
 *
 * On success the middleware sets `c.var.context` to a QuartalPluginContext and caches it in Deno KV keyed by the token.
 * On failure (missing header, bad token, failed verification) it responds with 401.
 *
 * @param opts OAuth options. Any unset field falls back to env vars (OAUTH_ISSUER / OAUTH_AUDIENCE / OAUTH_JWKS_URI).
 * @param pluginName Plugin name used to derive default OAuth resource and scope values.
 */
export function oauthAuthMiddleware(
  opts?: OAuthOptions,
  pluginName?: string,
): MiddlewareHandler<{ Variables: { context: QuartalPluginContext } }> {
  const resolved = resolveOAuthOptions(opts, pluginName);
  return createMiddleware(async (c, next) => {
    const resourceMetadataUrl = getProtectedResourceMetadataUrl(resolved, c.req.url);
    const challenge = { resourceMetadataUrl, scopes: resolved.scopes };
    const token = getTokenFromAuthHeader(c.req.header("Authorization"));
    if (!token) return unauthorized("missing token", challenge);

    const cache = getPluginCache();
    const cached = await cache.get<QuartalPluginContext>(kvKey(token));
    if (cached) {
      c.set("context", cached);
      return await next();
    }

    try {
      const { payload } = await jwtVerify(token, await getJwks(resolved), {
        issuer: resolved.issuer,
        audience: resolved.audience,
        algorithms: resolved.algorithms,
      });
      const context = resolved.claimsToContext(payload, token);
      c.set("context", context);
      const expireIn = computeExpireIn(payload, resolved.cacheTtlMs);
      if (expireIn > 0) {
        await cache.set(kvKey(token), context, { ttlMs: expireIn });
      }
      return await next();
    } catch (err) {
      if ((err as { code: string }).code === "ERR_JWT_EXPIRED") {
        await cache.delete(kvKey(token));
        return unauthorized("token expired", challenge);
      }
      console.error("OAuth token verification failed", err);
      return unauthorized("verification failed", challenge);
    }
  });
}

/**
 * Gets the cached QuartalPluginContext from Deno KV using the token in the AuthContext headers.
 * Used by the `execute` callback, which does not have access to Hono's `c.var` (MCP call path).
 * @param authContext The authentication context containing the headers with the Authorization token.
 * @returns The cached QuartalPluginContext if found and valid, otherwise undefined.
 * @example
 * ```ts
 * const context = await getOAuthContextFromKv({ headers: { Authorization: c.req.header("Authorization") ?? "" } });
 * if (!context) {
 *   return new Response("Unauthorized", { status: 401 });
 * }
 * // Proceed with authenticated context...
 * ```
 */
export async function getOAuthContextFromKv(
  authContext: AuthContext | undefined,
): Promise<QuartalPluginContext | undefined> {
  if (!authContext) return undefined;
  const authHeader = authContext.headers?.["Authorization"] ?? authContext.headers?.["authorization"];
  const token = getTokenFromAuthHeader(authHeader);
  if (!token) return undefined;
  const cache = getPluginCache();
  return (await cache.get<QuartalPluginContext>(kvKey(token))) ?? undefined;
}
