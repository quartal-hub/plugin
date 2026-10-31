import type { Hono } from "hono";
import type { WidgetRoutes } from "@quartal/plugin-embed";
import { buildEmbedGuide, buildEmbedIndex, type JsonSchema } from "@quartal/plugin-embed/guide";
import { renderWidgetsScript } from "@quartal/plugin-embed/script";
import type { WidgetEntry } from "../model/index.ts";
import type { PluginApiHelper } from "../hono-app/PluginApiHelper.ts";
import { buildWidgetRoutes } from "./buildWidgetRoutes.ts";

/** Cache policy of the embedding routes: short, so a redeployed plugin is picked up soon. */
const EMBED_CACHE_CONTROL = "public, max-age=300";

/** Options of {@link registerWidgetEmbedRoutes}. */
export interface WidgetEmbedRouteOptions {
  /** The plugin's widget entries. */
  widgets: readonly WidgetEntry[];
  /** The plugin's API needs a bearer token (said in the embedding guides). */
  requiresAuth: boolean;
}

/**
 * Registers the routes that let any web page embed the plugin's widgets:
 * `GET /widgets.js` (the `<qrtl-widget>` module with the route table baked in),
 * `GET /widgets/routes.json` (the route table), `GET /widgets/embed.md` (an index of the widgets)
 * and `GET /widgets/<toolId>/embed.md` (the copy-paste guide and coding-agent prompt of one
 * widget). The app's CORS middleware lets any origin load them.
 * @param app The plugin's Hono app.
 * @param helper The shared API helper.
 * @param options Widget entries and whether the API needs auth.
 */
export function registerWidgetEmbedRoutes(app: Hono, helper: PluginApiHelper, options: WidgetEmbedRouteOptions): void {
  let routes: Promise<WidgetRoutes> | null = null;
  let script: Promise<string> | null = null;
  const getRoutes = (origin: string): Promise<WidgetRoutes> => {
    routes ??= helper.getPluginInfo(origin).then((info) => buildWidgetRoutes(info, options.widgets));
    return routes;
  };

  app.get("/widgets.js", async (c) => {
    script ??= getRoutes(new URL(c.req.url).origin).then(renderWidgetsScript);
    c.header("cache-control", EMBED_CACHE_CONTROL);
    c.header("content-type", "text/javascript; charset=utf-8");
    return c.body(await script);
  });

  app.get("/widgets/routes.json", async (c) => {
    c.header("cache-control", EMBED_CACHE_CONTROL);
    return c.json(await getRoutes(new URL(c.req.url).origin));
  });

  /** Title and description of each widget: the overview's, else its tool's, else the widget name. */
  const describeWidgets = async (origin: string) => {
    const info = await helper.getPluginInfo(origin);
    const tools = new Map(helper.getMcpTools().map((t) => [t.id, t]));
    const listed = new Map(info.widgets.map((w) => [w.toolId, w]));
    return {
      info,
      widgets: options.widgets.map((w) => ({
        toolId: w.toolId,
        title: listed.get(w.toolId)?.title ?? tools.get(w.toolId)?.title ?? w.name,
        description: listed.get(w.toolId)?.description ?? tools.get(w.toolId)?.description,
      })),
    };
  };

  app.get("/widgets/embed.md", async (c) => {
    const origin = new URL(c.req.url).origin;
    const { info, widgets } = await describeWidgets(origin);
    c.header("content-type", "text/markdown; charset=utf-8");
    return c.body(buildEmbedIndex(origin, info.title ?? info.name, widgets));
  });

  app.get("/widgets/:toolId/embed.md", async (c) => {
    const origin = new URL(c.req.url).origin;
    const toolId = c.req.param("toolId");
    const { info, widgets } = await describeWidgets(origin);
    const widget = widgets.find((w) => w.toolId === toolId);
    if (!widget) return c.text(`No widget for tool "${toolId}".`, 404);
    const mcpTools = helper.getMcpTools();
    const tool = mcpTools.find((t) => t.id === toolId);
    const guide = buildEmbedGuide({
      pluginUrl: origin,
      pluginTitle: info.title ?? info.name,
      toolId,
      title: widget.title,
      description: widget.description,
      inputSchema: tool?.inputSchema as JsonSchema | undefined,
      appTools: mcpTools
        .filter((t) => t.visibility?.includes("app") && !t.visibility.includes("model"))
        .map((t) => ({ id: t.id, title: t.title, description: t.description, inputSchema: t.inputSchema as JsonSchema })),
      requiresAuth: options.requiresAuth,
    });
    c.header("content-type", "text/markdown; charset=utf-8");
    return c.body(guide.markdown);
  });
}
