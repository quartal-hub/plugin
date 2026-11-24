import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerOAuthLoginRoutes } from "../src/hono-app/oauthLoginRoutes.ts";
import { resolveOAuthOptions } from "../src/index.ts";
import { stubAuthServer } from "./helpers/authServer.ts";

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

const SHARED_CLIENT_ID = "https://plugin.quartal.com/.well-known/oauth/client-metadata.json";

/** A Cookie header carrying a pending login with the given state. */
function pendingCookie(state: string, clientId = SHARED_CLIENT_ID): string {
  const pending = { state, verifier: "v".repeat(43), clientId };
  return `qrtl_oauth_login=${Buffer.from(JSON.stringify(pending)).toString("base64url")}`;
}

/** The parameters in the fragment of a redirect to the docs SPA. */
function fragmentOf(res: Response): URLSearchParams {
  return new URLSearchParams((res.headers.get("Location") ?? "").split("#")[1]);
}

/** A token endpoint that issues `tok-abc`. */
const issueToken = () => Response.json({ access_token: "tok-abc", token_type: "Bearer", expires_in: 300 });

const savedTokenUrl = process.env.OAUTH_TOKEN_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (savedTokenUrl === undefined) delete process.env.OAUTH_TOKEN_URL;
  else process.env.OAUTH_TOKEN_URL = savedTokenUrl;
});

describe("client metadata document (CIMD)", () => {
  it("serves the plugin's own metadata with the request origin", async () => {
    const res = await appWithLoginRoutes().request("https://my-plugin.example.com/.well-known/oauth/client-metadata.json");
    expect(res.status).toBe(200);
    const doc = await res.json() as Record<string, unknown>;
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
    stubAuthServer(issuer);
    const res = await appWithLoginRoutes({ issuer }).request("https://my-plugin.example.com/oauth/login");
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get("Location")!);
    expect(url.origin + url.pathname).toBe(`${issuer}/auth`);
    expect(url.searchParams.get("response_type")).toBe("code");
    // Deployed origin → the plugin's own CIMD document is the client.
    expect(url.searchParams.get("client_id")).toBe("https://my-plugin.example.com/.well-known/oauth/client-metadata.json");
    expect(url.searchParams.get("redirect_uri")).toBe("https://my-plugin.example.com/oauth/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toContain("quartal-hub-test");
    expect(url.searchParams.get("resource")).toBe("https://my-plugin.example.com");
    expect(res.headers.get("Set-Cookie")).toContain("HttpOnly");
  });

  it("sends the state and the S256 challenge of the verifier stored in the cookie", async () => {
    const issuer = "https://iss-pkce.example.com";
    stubAuthServer(issuer);
    const res = await appWithLoginRoutes({ issuer }).request("https://my-plugin.example.com/oauth/login");
    const cookie = /qrtl_oauth_login=([^;]+)/.exec(res.headers.get("Set-Cookie") ?? "")![1];
    const pending = JSON.parse(Buffer.from(cookie, "base64url").toString()) as { state: string; verifier: string };
    const url = new URL(res.headers.get("Location")!);
    expect(url.searchParams.get("code_challenge")).toBe(createHash("sha256").update(pending.verifier).digest("base64url"));
    expect(url.searchParams.get("state")).toBe(pending.state);
  });

  it("forwards prompt=login and no other prompt value", async () => {
    const issuer = "https://iss-prompt.example.com";
    stubAuthServer(issuer);
    const app = appWithLoginRoutes({ issuer });
    const login = new URL((await app.request("https://my-plugin.example.com/oauth/login?prompt=login")).headers.get("Location")!);
    expect(login.searchParams.get("prompt")).toBe("login");
    const none = new URL((await app.request("https://my-plugin.example.com/oauth/login?prompt=none")).headers.get("Location")!);
    expect(none.searchParams.has("prompt")).toBe(false);
  });

  it("uses the shared plugin.quartal.com metadata as client_id on localhost", async () => {
    const issuer = "https://iss-local.example.com";
    stubAuthServer(issuer);
    const res = await appWithLoginRoutes({ issuer }).request("http://localhost:4321/oauth/login");
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get("Location")!);
    expect(url.searchParams.get("client_id")).toBe(SHARED_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:4321/oauth/callback");
  });

  it("uses the pre-registered clientId when configured (custom mode)", async () => {
    const issuer = "https://iss-preset.example.com";
    stubAuthServer(issuer);
    const res = await appWithLoginRoutes({ issuer, clientId: "my-registered-client" })
      .request("https://my-plugin.example.com/oauth/login");
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get("Location")!);
    expect(url.searchParams.get("client_id")).toBe("my-registered-client");
  });

  it("refuses discovery metadata naming another issuer", async () => {
    const issuer = "https://iss-mismatch.example.com";
    stubAuthServer(issuer, { metadata: { issuer: "https://evil.example.com" } });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await appWithLoginRoutes({ issuer }).request("https://my-plugin.example.com/oauth/login");
    expect(res.status).toBe(500);
    expect(logged).toHaveBeenCalledWith(expect.objectContaining({
      cause: expect.objectContaining({ code: "OAUTH_JSON_ATTRIBUTE_COMPARISON_FAILED" }),
    }));
  });

  it("allows plain HTTP only for a loopback issuer", async () => {
    const remote = "http://iss-plain.example.com";
    const remoteRequests = stubAuthServer(remote);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await appWithLoginRoutes({ issuer: remote }).request("https://my-plugin.example.com/oauth/login")).status).toBe(500);
    expect(logged).toHaveBeenCalledWith(expect.objectContaining({
      cause: expect.objectContaining({ code: "OAUTH_HTTP_REQUEST_FORBIDDEN" }),
    }));
    expect(remoteRequests).toEqual([]);

    const local = "http://localhost:8080/realms/dev";
    stubAuthServer(local);
    expect((await appWithLoginRoutes({ issuer: local }).request("http://localhost:4321/oauth/login")).status).toBe(302);
  });
});

describe("/oauth/callback", () => {
  it("reports an upstream error from the authorization server via the fragment", async () => {
    const requests = stubAuthServer("https://iss-upstream-error.example.com");
    const res = await appWithLoginRoutes({ issuer: "https://iss-upstream-error.example.com" }).request(
      "http://localhost:4321/oauth/callback?error=access_denied&error_description=User+cancelled",
    );
    expect(res.status).toBe(302);
    expect(fragmentOf(res).get("auth_error")).toBe("User cancelled");
    expect(requests).toEqual([]);
  });

  it("rejects a callback without the pending-login cookie", async () => {
    const requests = stubAuthServer("https://iss-no-cookie.example.com");
    const res = await appWithLoginRoutes({ issuer: "https://iss-no-cookie.example.com" })
      .request("http://localhost:4321/oauth/callback?code=abc&state=xyz");
    expect(res.status).toBe(302);
    expect(fragmentOf(res).get("auth_error")).toBe("Login session expired or invalid — try again.");
    expect(requests).toEqual([]);
  });

  it("exchanges the code server-side and delivers the token in the fragment", async () => {
    const issuer = "https://iss-exchange.example.com";
    const requests = stubAuthServer(issuer, { routes: { [`${issuer}/token`]: issueToken } });
    const res = await appWithLoginRoutes({ issuer }).request(
      "http://localhost:4321/oauth/callback?code=code-1&state=state-1",
      { headers: { Cookie: pendingCookie("state-1", "http://localhost:4321/.well-known/oauth/client-metadata.json") } },
    );
    expect(res.status).toBe(302);
    expect(fragmentOf(res).get("access_token")).toBe("tok-abc");
    expect(fragmentOf(res).get("expires_in")).toBe("300");
    const tokenRequest = requests.find((r) => r.url === `${issuer}/token`);
    expect(tokenRequest?.body?.get("grant_type")).toBe("authorization_code");
    expect(tokenRequest?.body?.get("code")).toBe("code-1");
    expect(tokenRequest?.body?.get("code_verifier")).toBe("v".repeat(43));
    expect(tokenRequest?.body?.get("client_id")).toBe("http://localhost:4321/.well-known/oauth/client-metadata.json");
    expect(tokenRequest?.body?.get("redirect_uri")).toBe("http://localhost:4321/oauth/callback");
    expect(tokenRequest?.body?.get("resource")).toBe("http://localhost:4321");
    // The pending-login cookie is single-use.
    expect(res.headers.get("Set-Cookie")).toContain("qrtl_oauth_login=;");
  });

  it("sends the login's redirect_uri and the plugin's own client id in the exchange on a deployed origin", async () => {
    const issuer = "https://iss-deployed.example.com";
    const requests = stubAuthServer(issuer, { routes: { [`${issuer}/token`]: issueToken } });
    const app = appWithLoginRoutes({ issuer });
    const login = await app.request("https://my-plugin.example.com/oauth/login");
    const cookie = /qrtl_oauth_login=([^;]+)/.exec(login.headers.get("Set-Cookie") ?? "")![1];
    const authorization = new URL(login.headers.get("Location")!);

    const res = await app.request(
      `https://my-plugin.example.com/oauth/callback?code=code-1&state=${authorization.searchParams.get("state")}`,
      { headers: { Cookie: `qrtl_oauth_login=${cookie}` } },
    );
    expect(fragmentOf(res).get("access_token")).toBe("tok-abc");
    const body = requests.find((r) => r.url === `${issuer}/token`)?.body;
    expect(body?.get("redirect_uri")).toBe(authorization.searchParams.get("redirect_uri"));
    expect(body?.get("redirect_uri")).toBe("https://my-plugin.example.com/oauth/callback");
    expect(body?.get("client_id")).toBe("https://my-plugin.example.com/.well-known/oauth/client-metadata.json");
    expect(body?.get("resource")).toBe("https://my-plugin.example.com");
  });

  it("returns a page login to its page with the token in the session cookie", async () => {
    const issuer = "https://iss-page-login.example.com";
    stubAuthServer(issuer, { routes: { [`${issuer}/token`]: issueToken } });
    const app = appWithLoginRoutes({ issuer });
    const login = await app.request("https://my-plugin.example.com/oauth/login?return_to=%2Fapp%2Fhome%3Ftab%3D2");
    const cookie = /qrtl_oauth_login=([^;]+)/.exec(login.headers.get("Set-Cookie") ?? "")![1];
    const state = new URL(login.headers.get("Location")!).searchParams.get("state");

    const res = await app.request(
      `https://my-plugin.example.com/oauth/callback?code=code-1&state=${state}`,
      { headers: { Cookie: `qrtl_oauth_login=${cookie}` } },
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/app/home?tab=2");
    const session = res.headers.getSetCookie().find((c) => c.startsWith("qrtl_session="));
    expect(session).toContain("qrtl_session=tok-abc");
    expect(session).toContain("HttpOnly");
    expect(session).toContain("Path=/");
    expect(session).toContain("Max-Age=300");
  });

  it("refuses a state mismatch without exchanging the code", async () => {
    const issuer = "https://iss-state.example.com";
    const requests = stubAuthServer(issuer, { routes: { [`${issuer}/token`]: issueToken } });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await appWithLoginRoutes({ issuer }).request(
      "http://localhost:4321/oauth/callback?code=abc&state=wrong-state",
      { headers: { Cookie: pendingCookie("expected-state") } },
    );
    expect(fragmentOf(res).get("auth_error")).toBe("Login failed — try again.");
    expect(fragmentOf(res).has("access_token")).toBe(false);
    expect(requests.map((r) => r.url)).not.toContain(`${issuer}/token`);
    expect(logged).toHaveBeenCalledWith("OAuth login failed", expect.objectContaining({
      cause: expect.objectContaining({ message: expect.stringMatching(/unexpected "state" response parameter value/) }),
    }));
  });

  it("refuses an iss parameter naming another issuer without exchanging the code (RFC 9207)", async () => {
    const issuer = "https://iss-param.example.com";
    const requests = stubAuthServer(issuer, {
      metadata: { authorization_response_iss_parameter_supported: true },
      routes: { [`${issuer}/token`]: issueToken },
    });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await appWithLoginRoutes({ issuer }).request(
      "http://localhost:4321/oauth/callback?code=c&state=s1&iss=https%3A%2F%2Fevil.example.com",
      { headers: { Cookie: pendingCookie("s1") } },
    );
    expect(fragmentOf(res).get("auth_error")).toBe("Login failed — try again.");
    expect(fragmentOf(res).has("access_token")).toBe(false);
    expect(requests.map((r) => r.url)).not.toContain(`${issuer}/token`);
    expect(logged).toHaveBeenCalledWith("OAuth login failed", expect.objectContaining({
      cause: expect.objectContaining({ message: expect.stringMatching(/unexpected "iss" \(issuer\) response parameter value/) }),
    }));
  });

  it("shows the token endpoint's error description", async () => {
    const issuer = "https://iss-token-error.example.com";
    stubAuthServer(issuer, {
      routes: { [`${issuer}/token`]: () => Response.json({ error: "invalid_grant", error_description: "Code not valid" }, { status: 400 }) },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await appWithLoginRoutes({ issuer }).request(
      "http://localhost:4321/oauth/callback?code=c&state=s1",
      { headers: { Cookie: pendingCookie("s1") } },
    );
    expect(fragmentOf(res).get("auth_error")).toBe("Code not valid");
  });

  it("uses OAUTH_TOKEN_URL instead of the discovered token endpoint", async () => {
    const issuer = "https://iss-token-url.example.com";
    process.env.OAUTH_TOKEN_URL = "https://token-override.example.com/token";
    const requests = stubAuthServer(issuer, { routes: { "https://token-override.example.com/token": issueToken } });
    const res = await appWithLoginRoutes({ issuer }).request(
      "http://localhost:4321/oauth/callback?code=c&state=s1",
      { headers: { Cookie: pendingCookie("s1") } },
    );
    expect(fragmentOf(res).get("access_token")).toBe("tok-abc");
    expect(requests.map((r) => r.url)).not.toContain(`${issuer}/token`);
  });

  it("reports a failed discovery as a failed login", async () => {
    const issuer = "https://iss-callback-down.example.com";
    stubAuthServer(issuer, { discoveryStatuses: [503] });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await appWithLoginRoutes({ issuer }).request(
      "http://localhost:4321/oauth/callback?code=c&state=s1",
      { headers: { Cookie: pendingCookie("s1") } },
    );
    expect(res.status).toBe(302);
    expect(fragmentOf(res).get("auth_error")).toBe("Login failed — try again.");
    expect(logged).toHaveBeenCalledWith("OAuth login failed", expect.objectContaining({
      message: expect.stringContaining(`OIDC discovery failed for ${issuer}`),
    }));
  });
});
