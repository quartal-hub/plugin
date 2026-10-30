import type { ToolRoute } from "../model/index.ts";

/**
 * Builds the REST request for a tool call: fills the path parameters, and sends the other input
 * properties as the query string (GET, DELETE) or the JSON body (POST, PUT).
 * @param baseUrl Plugin origin.
 * @param route The tool's route.
 * @param args The tool's input object.
 */
export function buildToolRequest(
  baseUrl: string,
  route: ToolRoute,
  args: Record<string, unknown>,
): { url: string; method: string; body?: string } {
  const rest: Record<string, unknown> = { ...args };
  const path = route.path.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = rest[name];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Missing path parameter "${name}" for ${route.method} ${route.path}.`);
    }
    delete rest[name];
    return encodeURIComponent(String(value));
  });
  const url = new URL(path, baseUrl);
  if (route.inputIn === "query") {
    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined || value === null) continue;
      for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, String(item));
    }
    return { url: url.href, method: route.method };
  }
  if (route.inputIn === "body") return { url: url.href, method: route.method, body: JSON.stringify(rest) };
  return { url: url.href, method: route.method };
}
