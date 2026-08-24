import type { Hono } from "hono";
import type { OpenAPIHono } from "@hono/zod-openapi";

import { PluginApiHelper } from "./PluginApiHelper.ts";
import { PluginMcpHelper } from "./PluginMcpHelper.ts";
import type { PluginAppConfig } from "../model/index.ts";
import { registerSkillRoutes } from "./skillRoutes.ts";
import { registerAgentRoutes } from "../agents/agentRoutes.ts";
import { registerPluginInfoRoutes } from "./pluginInfoRoutes.ts";
import { registerDocsSpaRoutes } from "./docsSpaRoutes.ts";
import { registerPublicFolderRoutes } from "./publicFolderRoutes.ts";
import { buildMcpServerImplementation } from "./pluginIcon.ts";
import { mcpServerDisplayName } from "./pluginMetadata.ts";
import { registerWidgetAssetRoutes, resolveWidgetEntries } from "../widgets/runtimeWidgets.ts";

/**
 * Returns a Hono app with all standard routes mounted, anonymous (no auth): REST API + OpenAPI,
 * docs SPA, skills, agents, plugin info, MCP, icons, and the public-folder catch-all.
 *
 * Widget MCP resources are discovered from `src/pages/widgets/` at startup (or supplied via
 * `config.widgetResources`) and served live on `resources/read`.
 * @param config Optional app configuration (plugin root, tool registry, mcp, etc.).
 */
export async function getAnonApp(config?: PluginAppConfig): Promise<Hono> {
  config = config ?? {};
  const helper = new PluginApiHelper("/api", config);
  await helper.init();
  const app: OpenAPIHono = helper.getApiApp();
  const mcpOptions = typeof config.mcp === "object" ? config.mcp : undefined;

  registerDocsSpaRoutes(app as Hono, { skinUrl: helper.manifest!.style.skin });
  registerSkillRoutes(app as Hono, config.pluginRootFolder, helper.manifest!);
  registerAgentRoutes(app as Hono, config.pluginRootFolder, helper.manifest!, {
    pluginTools: helper.getMcpCatalog().tools.map((t) => t.id),
    pluginServer: mcpServerDisplayName(helper.manifest!.name),
  });
  registerPluginInfoRoutes(
    app as Hono,
    helper,
    (origin) => buildMcpServerImplementation(helper.manifest!, mcpOptions, origin),
  );
  const widgets = config.widgetResources?.length ? config.widgetResources : await resolveWidgetEntries(config);
  helper.setWidgetCatalog(widgets.map((w) => ({ toolId: w.toolId, name: w.name })));
  if (widgets.length > 0 && config.mcp !== false) registerWidgetAssetRoutes(app as Hono);
  await PluginMcpHelper.applyToApp(app as Hono, helper, config, widgets);
  registerPublicFolderRoutes(app as Hono, config.pluginRootFolder);

  return app as Hono;
}
