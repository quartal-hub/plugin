import type {
  CallToolOptions,
  CallToolResult,
  ConnectPluginOptions,
  PluginAuth,
  PluginConnection,
  WidgetRoutes,
} from "../model/index.ts";
import { errorToolResult, jsonToolResult } from "../host/toolResults.ts";
import { buildToolRequest } from "./buildToolRequest.ts";
import { mountPluginWidget } from "./mountPluginWidget.ts";
import { PluginToolError } from "./PluginToolError.ts";

/** Path of the route table on the plugin origin. */
export const WIDGET_ROUTES_PATH = "/widgets/routes.json";

async function resolveToken(auth: PluginAuth): Promise<string | null | undefined> {
  return auth.getToken ? await auth.getToken() : auth.token;
}

/** The plugin's error message from an error response: its `{ error }` text, else the status text. */
function errorMessage(body: unknown, response: Response): string {
  if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  if (typeof body === "string" && body) return body;
  return `${response.status} ${response.statusText}`.trim();
}

/**
 * Connects to a Quartal plugin from a web page: call its tools over REST and show their widgets.
 * Nothing is fetched until the first call; the route table (`/widgets/routes.json`) is then read
 * once.
 *
 * ```ts
 * const plugin = connectPlugin({ url: "https://salaxy-anon.vercel.app" });
 * const salary = await plugin.callTool("simpleSalary", { rows });
 * plugin.mountWidget(document.getElementById("salary")!, { tool: "simpleSalary", args: { rows } });
 * ```
 * @param options Plugin origin, auth and (optionally) a known route table.
 */
export function connectPlugin(options: ConnectPluginOptions): PluginConnection {
  const url = new URL(options.url).origin;
  const doFetch = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  let auth: PluginAuth = { token: options.token, getToken: options.getToken };
  let routesPromise: Promise<WidgetRoutes> | null = options.routes ? Promise.resolve(options.routes) : null;

  const routes = (): Promise<WidgetRoutes> => {
    routesPromise ??= (async () => {
      const response = await doFetch(new URL(WIDGET_ROUTES_PATH, url), { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`Could not load ${url}${WIDGET_ROUTES_PATH}: ${response.status}`);
      return (await response.json()) as WidgetRoutes;
    })();
    // A failed load is retried on the next call.
    routesPromise.catch(() => {
      routesPromise = null;
    });
    return routesPromise;
  };

  const callTool = async <T = unknown>(
    name: string,
    args: Record<string, unknown> = {},
    callOptions: CallToolOptions = {},
  ): Promise<T> => {
    const route = (await routes()).tools[name];
    if (!route) throw new PluginToolError(`The plugin has no REST route for tool "${name}".`, 404);
    const request = buildToolRequest(url, route, args);
    const headers: Record<string, string> = { accept: "application/json" };
    if (request.body !== undefined) headers["content-type"] = "application/json";
    // Per-call auth wins; a call without a token of its own uses the connection's.
    const token = (await resolveToken(callOptions)) || (await resolveToken(auth));
    if (token) headers.authorization = `Bearer ${token}`;

    const response = await doFetch(request.url, {
      method: request.method,
      headers,
      ...(request.body !== undefined ? { body: request.body } : {}),
      ...(callOptions.signal ? { signal: callOptions.signal } : {}),
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      // Not JSON; keep the text.
    }
    if (!response.ok) throw new PluginToolError(errorMessage(body, response), response.status, body);
    return body as T;
  };

  const connection: PluginConnection = {
    url,
    routes,
    setAuth(next) {
      auth = { ...next };
    },
    callTool,
    async callToolResult(name, args, callOptions): Promise<CallToolResult> {
      try {
        return jsonToolResult(await callTool(name, args, callOptions));
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
    async widgetUrl(tool) {
      const widget = (await routes()).widgets[tool];
      if (!widget) throw new Error(`The plugin has no widget for tool "${tool}".`);
      return new URL(widget.path, url).href;
    },
    mountWidget(container, mountOptions) {
      return mountPluginWidget(connection, container, mountOptions);
    },
  };
  return connection;
}
