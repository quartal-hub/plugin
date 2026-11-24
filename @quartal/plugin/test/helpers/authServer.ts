import { vi } from "vitest";

/** A request received by the stubbed authorization server. */
export interface AuthServerRequest {
  url: string;
  /** The form body, for a token request. */
  body?: URLSearchParams;
}

/** How the stubbed authorization server answers. */
export interface AuthServerOptions {
  /**
   * Fields merged over the default discovery document, which names `issuer` and its `/auth`,
   * `/token` and `/certs` endpoints.
   */
  metadata?: Record<string, unknown>;
  /** HTTP statuses for successive discovery requests; once they are used up, discovery answers 200. */
  discoveryStatuses?: number[];
  /** Responses for other URLs, such as the token endpoint or the JWKS. */
  routes?: Record<string, () => Response>;
}

/**
 * Stubs global `fetch` with an authorization server for `issuer` and returns the requests it
 * receives, in order. A request to any other URL throws.
 *
 * `oauthAuth.ts` caches discovery and the JWKS per issuer for the whole test file, so every test
 * must use an issuer that no other test in the file uses.
 * @param issuer The issuer URL; the default endpoints are under it (without its trailing slash).
 * @param opts How the server answers.
 */
export function stubAuthServer(issuer: string, opts: AuthServerOptions = {}): AuthServerRequest[] {
  const requests: AuthServerRequest[] = [];
  const statuses = [...(opts.discoveryStatuses ?? [])];
  const base = issuer.replace(/\/$/, "");
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    requests.push({ url, body: init?.body instanceof URLSearchParams ? init.body : undefined });
    if (url.endsWith("/.well-known/openid-configuration")) {
      const status = statuses.shift() ?? 200;
      if (status !== 200) return new Response("unavailable", { status });
      return Response.json({
        issuer,
        authorization_endpoint: `${base}/auth`,
        token_endpoint: `${base}/token`,
        jwks_uri: `${base}/certs`,
        ...opts.metadata,
      });
    }
    const route = opts.routes?.[url];
    if (route) return route();
    throw new Error(`unexpected fetch: ${url}`);
  }));
  return requests;
}
