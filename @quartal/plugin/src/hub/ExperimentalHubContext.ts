import type { QuartalPluginContext } from "../model/index.ts";
import { EXPERIMENTAL_HUB_SERVICE_URLS, isExperimentalHubEnabled } from "./experimentalHubServices.ts";
import { HubApiClient } from "./HubApiClient.ts";
import { HubCompanies } from "./HubCompanies.ts";
import { HubFiles } from "./HubFiles.ts";
import { HubSecrets } from "./HubSecrets.ts";

/**
 * The Quartal Hub services, called as the current user: their companies, their secrets and the
 * companies' files. Get one per tool call with `getExperimentalHubContext(ctx)`.
 *
 * Available only in a plugin with `auth: "quartal-hub"`: the services accept the user's Quartal
 * Hub access token, which the context forwards as it is.
 * @experimental A prototype; the services, their URLs and this API will change.
 * @example
 * ```ts
 * import { getExperimentalHubContext } from "@quartal/plugin/hub";
 *
 * export class Reports {
 *   static async list(_input: unknown, ctx: QuartalPluginContext) {
 *     const hub = getExperimentalHubContext(ctx);
 *     const company = await hub.companies.getSelected();
 *     return { company, files: company ? await hub.files.list("/data/raportit") : [] };
 *   }
 * }
 * ```
 */
export class ExperimentalHubContext {
  /** The user's companies, an Advisory's customers, and the selected company. */
  readonly companies: HubCompanies;
  /** The user's own secrets. */
  readonly secrets: HubSecrets;
  /** The files of a company: by default the selected one. */
  readonly files: HubFiles;

  /**
   * @param ctx The tool's context: an authenticated user with an access token.
   * @throws When the plugin does not run with `auth: "quartal-hub"`, or the context has no token.
   */
  constructor(ctx: QuartalPluginContext) {
    if (!isExperimentalHubEnabled()) {
      throw new Error('The Quartal Hub services need `auth: "quartal-hub"` in qrtl.config.');
    }
    if (!ctx?.authenticated || !ctx.token) {
      throw new Error("The Quartal Hub services need a signed-in user with an access token.");
    }
    const iam = new HubApiClient(EXPERIMENTAL_HUB_SERVICE_URLS.iam, ctx.token);
    this.companies = new HubCompanies(iam, ctx.uid);
    this.secrets = new HubSecrets(iam);
    this.files = new HubFiles(new HubApiClient(EXPERIMENTAL_HUB_SERVICE_URLS.files, ctx.token), this.companies);
  }
}
