import type { QuartalPluginContext } from "@quartal/plugin-core";
import { PluginClient } from "@quartal/plugin-core";

import { InboxStore } from "../inbox/InboxStore.ts";
import { requireCompany } from "../inbox/requireCompany.ts";
import type { InboxRoute, NewInboxRoute, ReceiverCandidate } from "./model/index.ts";

/** The `EmailReceived` fields a receiving tool's input must have. */
const EMAIL_FIELDS = ["id", "from", "subject", "attachments"];

/**
 * Where the selected company's inbox delivers email: each route names a tool on a plugin and
 * optional conditions on the sender and subject. An email goes to every route it matches.
 */
export class Routes {
  /**
   * The selected company's routes.
   * @param input No parameters.
   * @returns The routes.
   * @readOnly
   */
  static async listRoutes(_input: {}, ctx: QuartalPluginContext): Promise<{ routes: InboxRoute[] }> {
    const { companyId } = await requireCompany(ctx);
    return { routes: await InboxStore.getRoutes(companyId) };
  }

  /**
   * Adds a route. Find a plugin's receiving tools with `findReceivers` first.
   * @param input The route.
   * @returns The route as saved.
   */
  static async addRoute(input: NewInboxRoute, ctx: QuartalPluginContext): Promise<InboxRoute> {
    const { companyId } = await requireCompany(ctx);
    const route: InboxRoute = { ...input, id: crypto.randomUUID().slice(0, 8), pluginUrl: input.pluginUrl.replace(/\/$/, "") };
    await InboxStore.setRoutes(companyId, [...(await InboxStore.getRoutes(companyId)), route]);
    return route;
  }

  /**
   * Removes a route.
   * @param input The route.
   * @returns Whether a route was removed.
   * @destructive
   */
  static async removeRoute(
    input: {
      /** The route id (from `listRoutes`). */
      id: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ removed: boolean }> {
    const { companyId } = await requireCompany(ctx);
    const routes = await InboxStore.getRoutes(companyId);
    const rest = routes.filter((r) => r.id !== input.id);
    await InboxStore.setRoutes(companyId, rest);
    return { removed: rest.length < routes.length };
  }

  /**
   * The tools on a plugin that can receive email: app-only tools (`@visibility app`) whose
   * input has the `EmailReceived` fields. Once the codegen publishes `@accepts`, this reads that.
   * @param input The plugin.
   * @returns The candidate tools.
   * @readOnly
   */
  static async findReceivers(
    input: {
      /** Base URL of the plugin, e.g. `https://invoices.example.com`. */
      pluginUrl: string;
    },
  ): Promise<{ receivers: ReceiverCandidate[] }> {
    const { tools } = await new PluginClient({ baseUrl: input.pluginUrl }).getMcpTools();
    const receivers = tools.flatMap((tool): ReceiverCandidate[] => {
      const fields = Object.keys(tool.inputSchema.properties ?? {});
      if (!EMAIL_FIELDS.every((f) => fields.includes(f))) return [];
      const visibility = (tool._meta?.ui as { visibility?: string[] } | undefined)?.visibility ?? [];
      const appOnly = visibility.includes("app") && !visibility.includes("model");
      return [{
        tool: tool.name,
        description: tool.description ?? "",
        reason: appOnly ? "App-only tool taking an EmailReceived input" : "Takes an EmailReceived input (also visible to models)",
      }];
    });
    return { receivers };
  }
}
