import { HubApiError } from "./HubApiError.ts";

/** Query-string values; `undefined` leaves the parameter out. */
export type HubQuery = Record<string, string | number | boolean | undefined>;

/**
 * Minimal JSON client for one Quartal Hub service: sends the user's access token as a bearer
 * token and turns a non-2xx response into a {@link HubApiError}.
 * @experimental Part of the experimental Quartal Hub services.
 */
export class HubApiClient {
  /**
   * @param baseUrl Base URL of the service, without a trailing slash.
   * @param token The current user's access token.
   */
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  /** `GET` a JSON resource. */
  get<T>(path: string, query?: HubQuery): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  /** Send a JSON request and parse the JSON response. */
  async request<T>(method: string, path: string, options: { query?: HubQuery; body?: unknown } = {}): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const headers: Record<string, string> = { Authorization: `Bearer ${this.token}`, Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    if (!res.ok) {
      const { message, code } = await errorDetails(res);
      throw new HubApiError(res.status, method, url.toString(), message, code);
    }
    return (await res.json()) as T;
  }
}

/**
 * The service's own error message and code (`{ error | message, code }` JSON, or plain text),
 * else the status text.
 */
async function errorDetails(res: Response): Promise<{ message: string; code?: string }> {
  const text = await res.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { error?: unknown; message?: unknown; code?: unknown };
    const message = body.message ?? body.error;
    const code = typeof body.code === "string" ? body.code : undefined;
    if (typeof message === "string" && message) return { message, code };
    if (code) return { message: text.slice(0, 500), code };
  } catch {
    // Not JSON: fall through to the raw text.
  }
  return { message: text.slice(0, 500) || res.statusText || "request failed" };
}
