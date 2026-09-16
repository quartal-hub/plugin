import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerOAuthLoginRoutes } from "../src/hono-app/oauthLoginRoutes.ts";
import { resolveOAuthOptions } from "../src/index.ts";

function appWithLoginRoutes(opts?: { clientId?: string; issuer?: string }) {
  const app = new Hono();
  const resolved = resolveOAuthOptions({
    issuer: opts?.issuer ?? "https://iss.example.com",
    audience: "https://hub.test.qrtl.com",
    scope: "quartal-hub-test",
    ...(opts?.clientId ? { clientId: opts.clientId } : {}),
  });
  registerOAuthLoginRoutes(app, resolved, "Test Plugin");
  return app;
}

/** Stubs global fetch to answer the issuer's OIDC discovery (the module caches per issuer). */
function stubDiscovery(issuer: string, tokenResponse?: Record<string, unknown>) {
  const calls: Array<{ url: string; body?: URLSearchParams }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, body: typeof init?.body === "object" && init.body instanceof URLSearchParams ? init.body : undefined });
    if (u.includes("/.well-known/openid-configuration")) {
      return new Response(JSON.stringify({
        authorization_endpoint: `${issuer}/auth`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/certs`,
      }), { headers: { "Content-Type": "application/json" } });
    }
    if (u === `${issuer}/token` && tokenResponse) {
      return new Response(JSON.stringify(tokenResponse), { headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`unexpected fetch: ${u}`);
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("client metadata document (CIMD)", () => {
  it("serves the plugin's own metadata with the request origin", async () => {
    const res = await appWithLoginRoutes().request("https://my-plugin.example.com/.well-known/oauth/client-metadata.json");
    expect(res.status).toBe(200);
    const doc = await res.json();
    expect(doc.client_id).toBe("https://my-plugin.example.com/.well-known/oauth/client-metadata.json");
    expect(doc.client_name).toBe("Test Plugin");
    expect(doc.redirect_uris).toEqual(["https://my-plugin.example.com/oauth/callback"]);
    expect(doc.token_endpoint_auth_method).toBe("none");
    expect(doc.scope).toContain("quartal-hub-test");
  });
});

describe("/oauth/login", () => {
  it("redirects to the authorization endpoint with PKCE and a pending-login cookie", async () => {
    const issuer = "https://iss-login.example.com";
    stubDiscovery(issuer);
    const res = await appWithLoginRoutes({ issuer }).request("https://my-plugin.example.com/oauth/login");
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get("Location")!);
    expect(url.origin + url.pathname).toBe(`${issuer}/auth`);
    expect(url.searchParams.get("response_type")).toBe("code");
    // Deployed origin → the plugin's own CIMD document is the client.
    expect(url.searchParams.get("client_id")).toBe("https://my-plugin.example.com/.well-known/oauth/client-metadata.json");
    expect(url.searchParams.get("redirect_uri")).toBe("https://my-plugin.example.com/oauth/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("scope")).toContain("quartal-hub-test");
    expect(url.searchParams.get("resource")).toBe("https://my-plugin.example.com");
    expect(res.headers.get("Set-Cookie")).toContain("qrtl_oauth_login=");
    expect(res.headers.get("Set-Cookie")).toContain("HttpOnly");
  });

  it("uses the shared plugin.quartal.com metadata as client_id on localhost", async () => {
    const issuer = "https://iss-local.example.com";
    stubDiscovery(issuer);
    const res = await appWithLoginRoutes({ issuer }).request("http://localhost:4321/oauth/login");
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get("Location")!);
    expect(url.searchParams.get("client_id")).toBe("https://plugin.quartal.com/.well-known/oauth/client-metadata.json");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:4321/oauth/callback");
  });

  it("uses the pre-registered clientId when configured (custom mode)", async () => {
    const issuer = "https://iss-preset.example.com";
    stubDiscovery(issuer);
    const res = await appWithLoginRoutes({ issuer, clientId: "my-registered-client" })
      .request("https://my-plugin.example.com/oauth/login");
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get("Location")!);
    expect(url.searchParams.get("client_id")).toBe("my-registered-client");
  });
});

describe("/oauth/callback", () => {
  it("reports an upstream error from the authorization server via the fragment", async () => {
    const res = await appWithLoginRoutes().request(
      "http://localhost:4321/oauth/callback?error=access_denied&error_description=User+cancelled",
    );
    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("#");
    expect(new URLSearchParams(location.split("#")[1]).get("auth_error")).toBe("User cancelled");
  });

  it("rejects a callback without the pending-login cookie", async () => {
    const res = await appWithLoginRoutes().request("http://localhost:4321/oauth/callback?code=abc&state=xyz");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("auth_error=");
  });

  it("exchanges the code server-side and delivers the token in the fragment", async () => {
    const issuer = "https://iss-exchange.example.com";
    const calls = stubDiscovery(issuer, { access_token: "tok-abc", token_type: "Bearer", expires_in: 300 });
    const pending = Buffer.from(JSON.stringify({
      state: "state-1",
      verifier: "v".repeat(43),
      clientId: "http://localhost:4321/.well-known/oauth/client-metadata.json",
      redirectUri: "http://localhost:4321/oauth/callback",
    })).toString("base64url");
    const res = await appWithLoginRoutes({ issuer }).request(
      "http://localhost:4321/oauth/callback?code=code-1&state=state-1",
      { headers: { Cookie: `qrtl_oauth_login=${pending}` } },
    );
    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("access_token=tok-abc");
    expect(location).toContain("expires_in=300");
    const tokenCall = calls.find((c) => c.url === `${issuer}/token`);
    expect(tokenCall?.body?.get("grant_type")).toBe("authorization_code");
    expect(tokenCall?.body?.get("code")).toBe("code-1");
    expect(tokenCall?.body?.get("code_verifier")).toBe("v".repeat(43));
    // The pending-login cookie is single-use.
    expect(res.headers.get("Set-Cookie")).toContain("qrtl_oauth_login=;");
  });

  it("rejects a state mismatch", async () => {
    const pending = Buffer.from(JSON.stringify({
      state: "expected-state",
      verifier: "v".repeat(43),
      clientId: "https://plugin.quartal.com/.well-known/oauth/client-metadata.json",
      redirectUri: "http://localhost:4321/oauth/callback",
    })).toString("base64url");
    const res = await appWithLoginRoutes().request(
      "http://localhost:4321/oauth/callback?code=abc&state=wrong-state",
      { headers: { Cookie: `qrtl_oauth_login=${pending}` } },
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("auth_error=");
  });
});
