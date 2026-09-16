import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
  getPluginCache,
  getOAuthContextFromKv,
  getProtectedResourceMetadataDoc,
  getProtectedResourceMetadataUrl,
  MemoryCache,
  oauthAuthMiddleware,
  resolveOAuthOptions,
  setPluginCache,
  unauthorized,
} from "../src/index.ts";
import type { QuartalPluginContext } from "../src/index.ts";

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
});

describe("resolveOAuthOptions — quartal-hub mode (default)", () => {
  it("applies the fixed Quartal Hub test-environment defaults", () => {
    const r = resolveOAuthOptions();
    expect(r.issuer).toContain("iam2026.test.qrtl.com");
    expect(r.audience).toBe("https://hub.test.qrtl.com");
    expect(r.scopes).toEqual(expect.arrayContaining(["quartal-hub-test", "profile", "email"]));
    expect(r.algorithms).toEqual(["RS256", "ES256"]);
    expect(r.resource).toBeUndefined(); // derived per request in the metadata document
  });

  it("honors OAUTH_ISSUER but ignores the other OAUTH_* variables", () => {
    process.env.OAUTH_ISSUER = "https://id.example.com/realms/x";
    process.env.OAUTH_AUDIENCE = "https://api.example.com";
    process.env.OAUTH_SCOPE = "other-scope";
    process.env.OAUTH_RESOURCE = "https://other.example.com";
    const r = resolveOAuthOptions();
    expect(r.issuer).toBe("https://id.example.com/realms/x");
    expect(r.audience).toBe("https://hub.test.qrtl.com");
    expect(r.scopes).toEqual(expect.arrayContaining(["quartal-hub-test"]));
    expect(r.scopes).not.toContain("other-scope");
    expect(r.resource).toBeUndefined();
  });

  it("lets explicit options win over env and defaults", () => {
    process.env.OAUTH_ISSUER = "https://env-issuer";
    const r = resolveOAuthOptions({ issuer: "https://opt-issuer", audience: "aud" });
    expect(r.issuer).toBe("https://opt-issuer");
    expect(r.audience).toBe("aud");
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
