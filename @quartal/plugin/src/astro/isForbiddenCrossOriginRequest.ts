/** Content types an HTML form can send — the only ones a cross-site page can submit without a CORS preflight. */
const FORM_CONTENT_TYPES = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Whether a request is a cross-site form-style submission that must be rejected (CSRF protection
 * for Astro pages, endpoints and actions rendered on demand). Mirrors Astro's
 * `security.checkOrigin` rule: only unsafe methods with no `content-type` or a form content type
 * are checked, by `Sec-Fetch-Site` with a fallback to `Origin`.
 *
 * The integration turns Astro's own check off — it runs ahead of every middleware and would
 * reject legitimate cross-origin calls to the plugin API (e.g. a body-less `DELETE`) — and the
 * plugin middleware applies this one to the requests it leaves to Astro instead.
 * @param request The incoming request.
 * @param url The request URL as the site sees it (its origin is compared with the `Origin` header).
 */
export function isForbiddenCrossOriginRequest(request: Request, url: URL): boolean {
  if (SAFE_METHODS.has(request.method)) return false;
  const contentType = request.headers.get("content-type")?.toLowerCase();
  if (contentType && !FORM_CONTENT_TYPES.some((t) => contentType.includes(t))) return false;
  const site = request.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";
  const origin = request.headers.get("origin");
  return !!origin && origin !== url.origin;
}
