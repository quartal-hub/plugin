/** HTTP methods a plugin tool is served with on the REST API. */
export type ToolRouteMethod = "GET" | "POST" | "PUT" | "DELETE";

/** The REST route of one plugin tool: where to send its input and how. */
export interface ToolRoute {
  /** HTTP method. */
  method: ToolRouteMethod;
  /** Path on the plugin origin, with `{name}` placeholders for path parameters (`/api/invoices/{id}`). */
  path: string;
  /** Input properties bound from the path, in path order. */
  pathParams: string[];
  /** Where the other input properties travel: the query string, the JSON body, or nowhere. */
  inputIn: "query" | "body" | "none";
}

/** A widget a plugin serves: the page to frame and its display name. */
export interface WidgetRouteEntry {
  /** Path of the widget page on the plugin origin (`/widgets/<toolId>`). */
  path: string;
  /** Display name of the widget. */
  title?: string;
}

/**
 * The plugin's embedding route table (`GET /widgets/routes.json`): the REST route of every tool
 * (keyed by MCP tool id, the name a widget uses in its own tool calls) and the widget pages.
 */
export interface WidgetRoutes {
  /** Plugin name (package name). */
  name?: string;
  /** Plugin display title. */
  title?: string;
  /** REST route by tool id. Tools without a REST route are left out. */
  tools: Record<string, ToolRoute>;
  /** Widget page by tool id. */
  widgets: Record<string, WidgetRouteEntry>;
}
