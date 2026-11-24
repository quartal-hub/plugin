import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  getPluginCache,
  getOAuthContextFromKv,
  getProtectedResourceMetadataDoc,
  getProtectedResourceMetadataUrl,
  getTokenEndpoint,
  MemoryCache,
  oauthAuthMiddleware,
  resolveOAuthOptions,
  setPluginCache,
  unauthorized,
} from "../src/index.ts";
import type { QuartalPluginContext } from "../src/index.ts";
import { stubAuthServer } from "./helpers/authServer.ts";

const OAUTH_ENV = ["OAUTH_ISSUER", "OAUTH_AUDIENCE", "OAUTH_JWKS_URI", "OAUTH_RESOURCE", "OAUTH_SCOPE", "OAUTH_TOKEN_URL", "OAUTH_CLIENT_ID"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  setPluginCache(new MemoryCache());
  for (const k of OAUTH_ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of OAUTH_ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("resolveOAuthOptions — quartal-hub mode (default)", () => {
  it("applies the fixed Quartal Hub test-environment defaults", () => {
    const r = resolveOAuthOptions();
    // TODO(iam2026, ~Oct 2026): the issuer temporarily points at test-iam.salaxy.com while the
    // new IAM environment is deployed; restore an issuer assertion once the final quartal.com
    // hostname is decided.
    expect(r.audience).toBe("https://hub.test.qrtl.com");
    expect(r.scopes).toEqual(expect.arrayContaining(["quartal-hub-test", "profile", "email"]));
    expect(r.algorithms).toEqual(["RS256", "ES256"]);
    expect(r.resource).toBeUndefined(); // derived per request in the metadata document
  });

  it("honors the OAUTH_* environment variables over the hub defaults", () => {
    process.env.OAUTH_ISSUER = "https://id.example.com/realms/x";
    process.env.OAUTH_AUDIENCE = "https://api.example.com";
    process.env.OAUTH_SCOPE = "other-scope";
    process.env.OAUTH_RESOURCE = "https://other.example.com";
    const r = resolveOAuthOptions();
    expect(r.issuer).toBe("https://id.example.com/realms/x");
    expect(r.audience).toBe("https://api.example.com");
    expect(r.scopes).toEqual(expect.arrayContaining(["other-scope"]));
    expect(r.scopes).not.toContain("quartal-hub-test");
    expect(r.resource).toBe("https://other.example.com");
  });

  it("lets explicit options win over env and defaults", () => {
    process.env.OAUTH_ISSUER = "https://env-issuer";
    const r = resolveOAuthOptions({ issuer: "https://opt-issuer", audience: "aud" });
    expect(r.issuer).toBe("https://opt-issuer");
    expect(r.audience).toBe("aud");
  });

  it("layers qrtl.config app defaults below env vars and above the hub defaults", () => {
    const appDefaults = {
      issuer: "https://test-iam.salaxy.com/auth/realms/salaxy",
      scope: "my-scope",
    };
    const r = resolveOAuthOptions(undefined, "quartal-hub", appDefaults);
    expect(r.issuer).toBe("https://test-iam.salaxy.com/auth/realms/salaxy");
    expect(r.scopes).toEqual(expect.arrayContaining(["my-scope", "profile", "email"]));
    expect(r.audience).toBe("https://hub.test.qrtl.com"); // hub default still fills the gaps

    process.env.OAUTH_ISSUER = "https://env-issuer";
    const overridden = resolveOAuthOptions(undefined, "quartal-hub", appDefaults);
    expect(overridden.issuer).toBe("https://env-issuer");
  });
});

describe("resolveOAuthOptions — custom mode", () => {
  it("reads issuer/audience from environment variables", () => {
    process.env.OAUTH_ISSUER = "https://id.example.com/realms/x";
    process.env.OAUTH_AUDIENCE = "https://api.example.com";
    const r = resolveOAuthOptions(undefined, "custom");
    expect(r.issuer).toBe("https://id.example.com/realms/x");
    expect(r.audience).toBe("https://api.example.com");
  });

  it("falls back to OAUTH_RESOURCE as the audience", () => {
    process.env.OAUTH_ISSUER = "https://id.example.com";
    process.env.OAUTH_RESOURCE = "https://plugin.example.com";
    const r = resolveOAuthOptions(undefined, "custom");
    expect(r.audience).toBe("https://plugin.example.com");
    expect(r.resource).toBe("https://plugin.example.com");
  });

  it("throws when no issuer is configured", () => {
    process.env.OAUTH_AUDIENCE = "https://api.example.com";
    expect(() => resolveOAuthOptions(undefined, "custom")).toThrow(/issuer/i);
  });

  it("throws when no audience can be determined", () => {
    process.env.OAUTH_ISSUER = "https://id.example.com";
    expect(() => resolveOAuthOptions(undefined, "custom")).toThrow(/audience is required/i);
  });

  it("reads issuer/audience/resource from qrtl.config app defaults, below env vars", () => {
    const appDefaults = {
      issuer: "https://id.example.com/realms/x",
      audience: "https://api.example.com",
      resource: "https://plugin.example.com",
    };
    const r = resolveOAuthOptions(undefined, "custom", appDefaults);
    expect(r.issuer).toBe("https://id.example.com/realms/x");
    expect(r.audience).toBe("https://api.example.com");
    expect(r.resource).toBe("https://plugin.example.com");

    process.env.OAUTH_AUDIENCE = "https://env-audience";
    const overridden = resolveOAuthOptions(undefined, "custom", appDefaults);
    expect(overridden.audience).toBe("https://env-audience");
  });
});

describe("Protected Resource Metadata (RFC 9728)", () => {
  it("builds the metadata document and discovery URL from a fixed resource", () => {
    const r = resolveOAuthOptions({ issuer: "https://iss", resource: "https://api.example.com", scope: "my-scope" }, "custom");
    const doc = getProtectedResourceMetadataDoc(r);
    expect(doc.resource).toBe("https://api.example.com");
    expect(doc.authorization_servers).toEqual(["https://iss"]);
    expect(doc.scopes_supported).toEqual(expect.arrayContaining(["my-scope"]));

    const url = getProtectedResourceMetadataUrl(r);
    expect(url).toBe("https://api.example.com/.well-known/oauth-protected-resource");
  });

  it("derives the resource from the request origin when none is configured", () => {
    const r = resolveOAuthOptions(); // quartal-hub: no fixed resource
    const doc = getProtectedResourceMetadataDoc(r, "http://localhost:4321/.well-known/oauth-protected-resource");
    expect(doc.resource).toBe("http://localhost:4321");
    expect(doc.authorization_servers).toEqual([r.issuer]);
  });
});

describe("unauthorized()", () => {
  it("emits a 401 with a Bearer challenge carrying resource_metadata and scope", () => {
    const res = unauthorized("missing token", {
      resourceMetadataUrl: "https://api.example.com/.well-known/oauth-protected-resource",
      scopes: ["auth-agent", "profile"],
    });
    expect(res.status).toBe(401);
    const challenge = res.headers.get("WWW-Authenticate") ?? "";
    expect(challenge).toContain('resource_metadata="https://api.example.com/.well-known/oauth-protected-resource"');
    expect(challenge).toContain('scope="auth-agent profile"');
  });
});

describe("oauthAuthMiddleware", () => {
  const ctx: QuartalPluginContext = { authenticated: true, uid: "user-1", email: "u@example.com", token: "tok-123" };

  function appWithAuth() {
    const app = new Hono<{ Variables: { context: QuartalPluginContext } }>();
    app.use("/me", oauthAuthMiddleware({ issuer: "https://iss", audience: "aud" }));
    app.get("/me", (c) => c.json(c.var.context));
    return app;
  }

  it("returns 401 (with challenge) when the Authorization header is missing", async () => {
    const res = await appWithAuth().request("/me");
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Bearer");
  });

  it("passes through using a cached context without hitting the JWKS", async () => {
    // Seed the cache with the internal key shape (["oauth_ctx", token]).
    await getPluginCache().set(["oauth_ctx", "tok-123"], ctx);
    const res = await appWithAuth().request("/me", { headers: { Authorization: "Bearer tok-123" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ctx);
  });
});

describe("getOAuthContextFromKv", () => {
  it("returns the cached context for the header token, else undefined", async () => {
    const ctx: QuartalPluginContext = { authenticated: true, uid: "u" };
    await getPluginCache().set(["oauth_ctx", "abc"], ctx);
    expect(await getOAuthContextFromKv({ headers: { Authorization: "Bearer abc" } })).toEqual(ctx);
    expect(await getOAuthContextFromKv({ headers: { Authorization: "Bearer nope" } })).toBeUndefined();
    expect(await getOAuthContextFromKv(undefined)).toBeUndefined();
  });
});

/** A discovery failure caused by an oauth4webapi error with the given code. */
const discoveryFailure = (issuer: string, code: string) => expect.objectContaining({
  message: expect.stringContaining(`OIDC discovery failed for ${issuer}`),
  cause: expect.objectContaining({ code }),
});

describe("OIDC discovery", () => {
  it("resolves the token endpoint from discovery, and caches the metadata per issuer", async () => {
    const issuer = "https://disc-cache.example.com";
    const requests = stubAuthServer(issuer);
    expect(await getTokenEndpoint({ issuer })).toBe(`${issuer}/token`);
    expect(await getTokenEndpoint({ issuer })).toBe(`${issuer}/token`);
    expect(requests.map((r) => r.url)).toEqual([`${issuer}/.well-known/openid-configuration`]);
  });

  it("prefers an explicit tokenUrl, then OAUTH_TOKEN_URL, over discovery", async () => {
    const issuer = "https://disc-explicit.example.com";
    const requests = stubAuthServer(issuer);
    process.env.OAUTH_TOKEN_URL = "https://env.example.com/token";
    expect(await getTokenEndpoint({ issuer, tokenUrl: "https://explicit.example.com/token" })).toBe("https://explicit.example.com/token");
    expect(await getTokenEndpoint({ issuer })).toBe("https://env.example.com/token");
    expect(requests).toEqual([]);
  });

  it("retries discovery after a failure instead of caching it", async () => {
    const issuer = "https://disc-retry.example.com";
    const requests = stubAuthServer(issuer, { discoveryStatuses: [503] });
    await expect(getTokenEndpoint({ issuer })).rejects.toThrow(`OIDC discovery failed for ${issuer}`);
    expect(await getTokenEndpoint({ issuer })).toBe(`${issuer}/token`);
    expect(requests).toHaveLength(2);
  });

  it("requires the metadata to name the configured issuer exactly, including a trailing slash", async () => {
    const withSlash = "https://disc-slash.example.com/realms/a/";
    stubAuthServer(withSlash, { metadata: { issuer: "https://disc-slash.example.com/realms/a" } });
    await expect(getTokenEndpoint({ issuer: withSlash }))
      .rejects.toEqual(discoveryFailure(withSlash, "OAUTH_JSON_ATTRIBUTE_COMPARISON_FAILED"));

    const matching = "https://disc-slash-ok.example.com/realms/a/";
    stubAuthServer(matching);
    expect(await getTokenEndpoint({ issuer: matching })).toBe("https://disc-slash-ok.example.com/realms/a/token");
  });

  it("allows plain HTTP only for a loopback issuer", async () => {
    for (const issuer of ["http://localhost:8081/realms/dev", "http://127.0.0.1:8081/realms/dev", "http://[::1]:8081/realms/dev"]) {
      stubAuthServer(issuer);
      expect(await getTokenEndpoint({ issuer })).toBe(`${issuer}/token`);
    }
    const remote = "http://disc-plain.example.com";
    const requests = stubAuthServer(remote);
    await expect(getTokenEndpoint({ issuer: remote })).rejects.toEqual(discoveryFailure(remote, "OAUTH_HTTP_REQUEST_FORBIDDEN"));
    expect(requests).toEqual([]);
  });
});

describe("oauthAuthMiddleware with a discovered JWKS", () => {
  async function signedToken(issuer: string) {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = { ...await exportJWK(publicKey), kid: "k1", alg: "RS256" };
    const token = await new SignJWT({ email: "u@example.com" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(issuer)
      .setAudience("aud")
      .setSubject("user-1")
      .setExpirationTime("5m")
      .sign(privateKey);
    return { token, jwks: () => Response.json({ keys: [jwk] }) };
  }

  function appWithAuth(issuer: string) {
    const app = new Hono<{ Variables: { context: QuartalPluginContext } }>();
    app.use("/me", oauthAuthMiddleware({ issuer, audience: "aud" }));
    app.get("/me", (c) => c.json(c.var.context));
    return app;
  }

  it("verifies a token against the jwks_uri from discovery", async () => {
    const issuer = "https://mw-jwks.example.com";
    const { token, jwks } = await signedToken(issuer);
    const requests = stubAuthServer(issuer, { routes: { [`${issuer}/certs`]: jwks } });
    const res = await appWithAuth(issuer).request("/me", { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect((await res.json() as QuartalPluginContext).uid).toBe("user-1");
    expect(requests.map((r) => r.url)).toContain(`${issuer}/certs`);
  });

  it("rejects tokens without fetching keys when discovery names another issuer", async () => {
    const issuer = "https://mw-mismatch.example.com";
    const { token, jwks } = await signedToken(issuer);
    const requests = stubAuthServer(issuer, { metadata: { issuer: "https://evil.example.com" }, routes: { [`${issuer}/certs`]: jwks } });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await appWithAuth(issuer).request("/me", { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
    expect(logged).toHaveBeenCalledWith(
      "OAuth token verification failed",
      discoveryFailure(issuer, "OAUTH_JSON_ATTRIBUTE_COMPARISON_FAILED"),
    );
    expect(requests.map((r) => r.url)).not.toContain(`${issuer}/certs`);
  });
});
