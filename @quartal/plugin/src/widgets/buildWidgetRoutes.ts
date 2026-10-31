import type { WidgetRoutes } from "@quartal/plugin-embed";
import type { PluginInfo, WidgetEntry } from "../model/index.ts";
import { QUERY_METHODS } from "../code/resolveRestRoutes.ts";

/**
 * The plugin's embedding route table (`/widgets/routes.json`, and baked into `/widgets.js`): the
 * REST route of every tool exposed over both MCP and REST, keyed by MCP tool id — the name a widget
 * uses in its own tool calls — and the page of every widget the plugin serves.
 * @param info The plugin overview (`contents.json`).
 * @param widgets The plugin's widget entries, as served over MCP.
 */
export function buildWidgetRoutes(info: PluginInfo, widgets: readonly WidgetEntry[]): WidgetRoutes {
  const tools: WidgetRoutes["tools"] = {};
  for (const tool of info.tools) {
    const { mcpName, restUrl, restMethod, restPathParams, restInputIn } = tool.exposure;
    if (!mcpName || !restUrl || !restMethod) continue;
    tools[mcpName] = {
      method: restMethod,
      path: restUrl,
      pathParams: restPathParams ?? [],
      inputIn: restInputIn ?? (QUERY_METHODS.has(restMethod) ? "query" : "body"),
    };
  }
  const titles = new Map(info.widgets.map((w) => [w.toolId, w.title]));
  const widgetPages: WidgetRoutes["widgets"] = {};
  for (const widget of widgets) {
    widgetPages[widget.toolId] = {
      path: widget.pagePath ?? `/widgets/${widget.toolId}`,
      title: titles.get(widget.toolId) ?? widget.name,
    };
  }
  return { name: info.name, title: info.title, tools, widgets: widgetPages };
}
