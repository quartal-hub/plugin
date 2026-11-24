import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import * as client from "openid-client";

import type { QuartalPluginContext } from "@quartal/plugin-core";
import { isLoopbackUrl, loginClient, type ResolvedOAuthOptions } from "../oauth/oauthAuth.ts";

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
 *   never sent to a server. A login started by a page (`/oauth/login?return_to=/path`) instead
 *   keeps the token in the HttpOnly page-session cookie and returns the browser to that page.
 * - `GET /oauth/session` — the page session's person and token (401 without one); same-origin
 *   pages read it to call the plugin's API or embed its widgets.
 * - `GET /oauth/logout` — ends the page session.
 *
 * The client_id: a pre-registered `clientId` (custom mode / `OAUTH_CLIENT_ID`) wins when set —
 * Auth0 and Entra ID have no CIMD. Otherwise the plugin's own metadata URL is used, except on
 * localhost, where the authorization server cannot fetch it — there the shared document published
 * on plugin.quartal.com (whose redirect URI is `http://localhost:4321/oauth/callback`) is used.
 */

/** Shared CIMD document for localhost development; its redirect URI is `http://localhost:4321/oauth/callback`. */
const LOCALHOST_CLIENT_METADATA_URL = "https://plugin.quartal.com/.well-known/oauth/client-metadata.json";

/** Cookie carrying the pending login's PKCE verifier, state and client id. */
const LOGIN_COOKIE = "qrtl_oauth_login";

/** HttpOnly cookie carrying the page session's access token (`site.access: "user"`). */
export const SESSION_COOKIE = "qrtl_session";

/**
 * A safe `return_to` for a page login: a same-origin absolute path, never `//host` or a URL.
 * @param value The requested path.
 */
export function safeReturnPath(value: string | undefined): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return undefined;
  return value;
}

function originOf(c: Context): string {
  return new URL(c.req.url).origin;
}

function clientMetadataUrl(origin: string): string {
  return `${origin}/.well-known/oauth/client-metadata.json`;
}

/** The client_id for a login started from `origin` — see the module doc for the selection rules. */
function clientIdFor(resolved: ResolvedOAuthOptions, origin: string): string {
  if (resolved.clientId) return resolved.clientId;
  return isLoopbackUrl(origin) ? LOCALHOST_CLIENT_METADATA_URL : clientMetadataUrl(origin);
}

/** State stored in the login cookie between /oauth/login and /oauth/callback. */
interface PendingLogin {
  state: string;
  verifier: string;
  clientId: string;
  /** Set for a login started by a page: where to return, with the token in the session cookie. */
  returnTo?: string;
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
 * @param verifyToken Verifies the page session's token (see `createTokenVerifier`); without it
 *   `/oauth/session` answers 401.
 */
export function registerOAuthLoginRoutes(
  app: Hono,
  resolved: ResolvedOAuthOptions,
  clientName: string,
  verifyToken?: (token: string) => Promise<QuartalPluginContext | undefined>,
): void {
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
    const pending: PendingLogin = {
      state: client.randomState(),
      verifier: client.randomPKCECodeVerifier(),
      clientId: clientIdFor(resolved, origin),
      ...(safeReturnPath(c.req.query("return_to")) ? { returnTo: safeReturnPath(c.req.query("return_to")) } : {}),
    };
    const config = await loginClient(resolved.issuer, pending.clientId);
    setCookie(c, LOGIN_COOKIE, Buffer.from(JSON.stringify(pending)).toString("base64url"), {
      httpOnly: true,
      sameSite: "Lax",
      secure: origin.startsWith("https:"),
      path: "/oauth",
      maxAge: 600,
    });
    const url = client.buildAuthorizationUrl(config, {
      redirect_uri: `${origin}/oauth/callback`,
      scope: resolved.scopes.join(" "),
      state: pending.state,
      code_challenge: await client.calculatePKCECodeChallenge(pending.verifier),
      code_challenge_method: "S256",
      // RFC 8707 resource indicator — ignored by authorization servers without support.
      resource: origin,
      // OIDC `prompt=login` forces the login screen despite an active SSO session, so a user who
      // logged out of the docs site can switch accounts. Only `login` is forwarded — the route must
      // not become a vehicle for arbitrary authorization-request parameters.
      ...(c.req.query("prompt") === "login" ? { prompt: "login" } : {}),
    });
    return c.redirect(url.toString(), 302);
  });

  app.get("/oauth/callback", async (c) => {
    const cookie = getCookie(c, LOGIN_COOKIE);
    deleteCookie(c, LOGIN_COOKIE, { path: "/oauth" });

    // Shown even without a pending login: it is only a message from the authorization server.
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
    if (!pending) {
      return fragmentRedirect(c, { auth_error: "Login session expired or invalid — try again." });
    }

    let token: client.TokenEndpointResponse;
    try {
      // Checks `state` and, when the server sends it, the `iss` parameter (RFC 9207), then
      // exchanges the code. The redirect URI is this callback URL without its query.
      token = await client.authorizationCodeGrant(
        await loginClient(resolved.issuer, pending.clientId),
        new URL(c.req.url),
        { expectedState: pending.state, pkceCodeVerifier: pending.verifier },
        { resource: originOf(c) },
      );
    } catch (err) {
      console.error("OAuth login failed", err);
      const message = err instanceof client.ResponseBodyError
        ? err.error_description || err.error
        : "Login failed — try again.";
      return fragmentRedirect(c, { auth_error: message });
    }
    if (pending.returnTo) {
      setCookie(c, SESSION_COOKIE, token.access_token, {
        httpOnly: true,
        sameSite: "Lax",
        secure: originOf(c).startsWith("https:"),
        path: "/",
        ...(token.expires_in ? { maxAge: token.expires_in } : {}),
      });
      return c.redirect(pending.returnTo, 302);
    }
    return fragmentRedirect(c, {
      access_token: token.access_token,
      ...(token.expires_in ? { expires_in: String(token.expires_in) } : {}),
    });
  });

  app.get("/oauth/session", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    const context = token && verifyToken ? await verifyToken(token) : undefined;
    if (!context) return c.json({ error: "no session" }, 401);
    return c.json(context, 200, { "Cache-Control": "no-store" });
  });

  app.get("/oauth/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.redirect(safeReturnPath(c.req.query("return_to")) ?? "/", 302);
  });
}
