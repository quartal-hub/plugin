import { AjaxFetch } from "@salaxy/core";
import type { QuartalPluginContext } from "@quartal/plugin-core";

/**
 * The Quartal IAM API that exchanges a Quartal IAM session for a Salaxy SSO token
 * (`/api/SalaxySso/getToken`, see `${QUARTAL_IAM_API_URL}/open-api.json`).
 * Overridable via the `QUARTAL_IAM_API_URL` environment variable.
 */
const IAM_API_URL = process.env.QUARTAL_IAM_API_URL || "https://iam-api.quartal.deno.net";

/** Result of the IAM API `/api/SalaxySso/getToken`: the Salaxy token and the API root to use it against. */
export interface SalaxyToken {
  /** The Salaxy bearer token (about 48 h; no refresh token — call getToken again). */
  accessToken: string;
  /** Token type, `"Bearer"`. */
  tokenType: string;
  /** The Salaxy account the token acts as (IBAN format). */
  accountId: string;
  /** The account whose certificate signed the SSO assertion — the caller's own account. */
  issuerAccountId: string;
  /** Salaxy API root to call with the token, e.g. `https://test-api.salaxy.com`. */
  apiUrl: string;
  /** When the token expires, ISO 8601 (from the token's `exp` claim when present). */
  expiresAt?: string;
}

/**
 * The Salaxy session/API context the tools need — an authenticated Salaxy `AjaxFetch` client
 * plus the SSO token metadata (account ids, API root, expiry).
 */
export interface SalaxyContext {
  /** Returns an authenticated Salaxy ajax client for the current user. */
  getAjax(): AjaxFetch;
  /** The Salaxy SSO token this context was built from. */
  token: SalaxyToken;
}

// The Salaxy token lives ~48 h but the cache key is the caller's Quartal access token (~1 h),
// so entries die with the Quartal session; the extra cap below keeps the map from growing stale.
const TOKEN_CACHE_MAX_TTL_MS = 30 * 60 * 1000;
const tokenCache = new Map<string, { token: SalaxyToken; validUntil: number }>();

async function getSalaxyToken(quartalToken: string): Promise<SalaxyToken> {
  const cached = tokenCache.get(quartalToken);
  if (cached && cached.validUntil > Date.now()) return cached.token;
  tokenCache.delete(quartalToken);

  const res = await fetch(`${IAM_API_URL}/api/SalaxySso/getToken`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${quartalToken}`,
      "Content-Type": "application/json",
    },
    // "self": act as the caller's own Salaxy account (sub-account SSO would pass its accountId).
    body: JSON.stringify({ accountId: "self" }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint = res.status === 401
      ? `The Quartal token was not accepted by the IAM API — it must carry the "iam-api" scope/audience `
        + `(the IAM realm must allow the plugin's client to request that scope).`
      : `Make sure your Salaxy certificate is stored in the Quartal account console `
        + `(Salaxy: Settings → Authorisations → Digital certificate).`;
    throw new Error(
      `Salaxy SSO token exchange failed (${res.status} ${res.statusText}) at ${IAM_API_URL}/api/SalaxySso/getToken. `
        + `${hint} ${body}`.trim(),
    );
  }
  const token = await res.json() as SalaxyToken;

  const expiresAtMs = token.expiresAt ? Date.parse(token.expiresAt) : NaN;
  const validUntil = Math.min(
    Date.now() + TOKEN_CACHE_MAX_TTL_MS,
    Number.isNaN(expiresAtMs) ? Infinity : expiresAtMs,
  );
  if (validUntil > Date.now()) tokenCache.set(quartalToken, { token, validUntil });
  return token;
}

/**
 * Maps the Quartal IAM context ({@link QuartalPluginContext}) to a {@link SalaxyContext}:
 * exchanges the verified Quartal access token for a Salaxy SSO token via the Quartal IAM API
 * and builds an authenticated `AjaxFetch` against the API root the exchange returns.
 * @param ctx The verified Quartal IAM context for the current request.
 */
export async function quartalContextToSalaxyContext(ctx: QuartalPluginContext): Promise<SalaxyContext> {
  if (!ctx.token) {
    throw new Error("Salaxy tools require an authenticated Quartal session (no access token in context).");
  }
  const token = await getSalaxyToken(ctx.token);
  return {
    token,
    getAjax: () => new AjaxFetch(token.accessToken, token.apiUrl),
  };
}
