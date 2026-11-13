import type { QuartalPluginContext } from "../model/index.ts";
import { ExperimentalHubContext } from "./ExperimentalHubContext.ts";

/**
 * The Quartal Hub services — companies, secrets and files — called as the user of a tool call.
 * Available only in a plugin with `auth: "quartal-hub"`.
 * @param ctx The tool's context (the second parameter of every tool method).
 * @returns The services, authenticated with the user's access token.
 * @throws When the plugin does not run with `auth: "quartal-hub"`, or the context has no token.
 * @experimental A prototype; the services, their URLs and this API will change.
 * @example
 * ```ts
 * const hub = getExperimentalHubContext(ctx);
 * const companies = await hub.companies.list();
 * ```
 */
export function getExperimentalHubContext(ctx: QuartalPluginContext): ExperimentalHubContext {
  return new ExperimentalHubContext(ctx);
}
