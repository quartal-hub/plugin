import { createHash, randomBytes } from "node:crypto";
import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import {
  getAuthorizationEndpoint,
  getTokenEndpoint,
  type ResolvedOAuthOptions,
} from "../oauth/oauthAuth.ts";

/**
 * Browser login for the plugin's docs site, using the same OAuth method as MCP clients:
 * authorization code + PKCE with a CIMD client (the client_id is a client-metadata-document URL).
 *
 * - `GET /.well-known/oauth/client-metadata.json` — the plugin's own CIMD document. A deployed
 *   plugin is its own OAuth client: the authorization server fetches this URL to learn the
 *   client's name and redirect URIs.
 * - `GET /oauth/login` — starts the flow: stores the PKCE verifier + state in an HttpOnly cookie
 *   and redirects the browser to the authorization endpoint.
 * - `GET /oauth/callback` — exchanges the code for a token **server-side** (no CORS dependency on
 *   the authorization server) and hands the token to the docs SPA in the URL fragment, which is
 *   never sent to a server.
 *
 * The client_id: a pre-registered `clientId` (custom mode / `OAUTH_CLIENT_ID`) wins when set —
 * Auth0 and Entra ID have no CIMD. Otherwise the plugin's own metadata URL is used, except on
 * localhost, where the authorization server cannot fetch it — there the shared document published
 * on plugin.quartal.com (whose redirect URI is `http://localhost:4321/oauth/callback`) is used.
 */

/** Shared CIMD document for localhost development; its redirect URI is `http://localhost:4321/oauth/callback`. */
const LOCALHOST_CLIENT_METADATA_URL = "https://plugin.quartal.com/.well-known/oauth/client-metadata.json";

/** Cookie carrying the pending login's PKCE verifier, state and redirect parameters. */
const LOGIN_COOKIE = "qrtl_oauth_login";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function originOf(c: Context): string {
  return new URL(c.req.url).origin;
}

function isLocalOrigin(origin: string): boolean {
  return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
}

function clientMetadataUrl(origin: string): string {
  return `${origin}/.well-known/oauth/client-metadata.json`;
}

/** The client_id for a login started from `origin` — see the module doc for the selection rules. */
function clientIdFor(resolved: ResolvedOAuthOptions, origin: string): string {
  if (resolved.clientId) return resolved.clientId;
  return isLocalOrigin(origin) ? LOCALHOST_CLIENT_METADATA_URL : clientMetadataUrl(origin);
}

/** State stored in the login cookie between /oauth/login and /oauth/callback. */
interface PendingLogin {
  state: string;
  verifier: string;
  clientId: string;
  redirectUri: string;
}

/** Redirects to the docs SPA root with values in the URL fragment (kept out of server logs). */
function fragmentRedirect(c: Context, params: Record<string, string>): Response {
  const fragment = new URLSearchParams(params).toString();
  return c.redirect(`/#${fragment}`, 302);
}

/**
 * Registers the docs-site OAuth login routes on the app. Unauthenticated by design: they are how
 * a browser session obtains a token in the first place.
 * @param app The Hono app.
 * @param resolved Resolved OAuth options (issuer, scopes, optional pre-registered clientId).
 * @param clientName Human-readable client name advertised in the CIMD document (the plugin title).
 */
export function registerOAuthLoginRoutes(app: Hono, resolved: ResolvedOAuthOptions, clientName: string): void {
  app.get("/.well-known/oauth/client-metadata.json", (c) => {
    const origin = originOf(c);
    return c.json({
      client_id: clientMetadataUrl(origin),
      client_name: clientName,
      client_uri: origin,
      redirect_uris: [`${origin}/oauth/callback`],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: resolved.scopes.join(" "),
    });
  });

  app.get("/oauth/login", async (c) => {
    const origin = originOf(c);
    const authorizationEndpoint = await getAuthorizationEndpoint(resolved.issuer);
    const pending: PendingLogin = {
      state: base64url(randomBytes(24)),
      verifier: base64url(randomBytes(48)),
      clientId: clientIdFor(resolved, origin),
      redirectUri: `${origin}/oauth/callback`,
    };
    setCookie(c, LOGIN_COOKIE, base64url(Buffer.from(JSON.stringify(pending))), {
      httpOnly: true,
      sameSite: "Lax",
      secure: origin.startsWith("https:"),
      path: "/oauth",
      maxAge: 600,
    });
    const url = new URL(authorizationEndpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", pending.clientId);
    url.searchParams.set("redirect_uri", pending.redirectUri);
    url.searchParams.set("scope", resolved.scopes.join(" "));
    url.searchParams.set("state", pending.state);
    url.searchParams.set("code_challenge", base64url(createHash("sha256").update(pending.verifier).digest()));
    url.searchParams.set("code_challenge_method", "S256");
    // RFC 8707 resource indicator — ignored by authorization servers without support.
    url.searchParams.set("resource", origin);
    return c.redirect(url.toString(), 302);
  });

  app.get("/oauth/callback", async (c) => {
    const cookie = getCookie(c, LOGIN_COOKIE);
    deleteCookie(c, LOGIN_COOKIE, { path: "/oauth" });

    const upstreamError = c.req.query("error");
    if (upstreamError) {
      return fragmentRedirect(c, {
        auth_error: c.req.query("error_description") || upstreamError,
      });
    }

    let pending: PendingLogin | undefined;
    try {
      if (cookie) pending = JSON.parse(Buffer.from(cookie, "base64url").toString()) as PendingLogin;
    } catch {
      // fall through to the error below
    }
    const code = c.req.query("code");
    if (!pending || !code || c.req.query("state") !== pending.state) {
      return fragmentRedirect(c, { auth_error: "Login session expired or invalid — try again." });
    }

    const tokenEndpoint = await getTokenEndpoint({ issuer: resolved.issuer });
    const res = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: pending.redirectUri,
        client_id: pending.clientId,
        code_verifier: pending.verifier,
        resource: originOf(c),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`OAuth token exchange failed (${res.status}): ${body}`);
      let message = `Token exchange failed (${res.status}).`;
      try {
        const err = JSON.parse(body) as { error?: string; error_description?: string };
        message = err.error_description || err.error || message;
      } catch {
        // keep the generic message
      }
      return fragmentRedirect(c, { auth_error: message });
    }
    const token = await res.json() as { access_token: string; token_type?: string; expires_in?: number };
    return fragmentRedirect(c, {
      access_token: token.access_token,
      ...(token.expires_in ? { expires_in: String(token.expires_in) } : {}),
    });
  });
}
