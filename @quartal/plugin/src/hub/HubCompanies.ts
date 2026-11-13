import { getPluginCache } from "../cache/PluginCache.ts";
import type { HubCompany, HubCompanyDetails, HubCustomerList, HubSelectedCompany } from "../model/index.ts";
import type { HubApiClient } from "./HubApiClient.ts";

/** How long a company selection is kept without being set again. */
const SELECTED_COMPANY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The companies the current user is linked to, from the Quartal IAM API, and the company the user
 * has selected to work in.
 *
 * A user is linked to a company directly (a membership with a role) or as a customer of an
 * Advisory (accounting firm) whose team the user belongs to. Access is resolved from the
 * directory on every call, never from the roles in the user's token.
 *
 * The selected company is stored per user in the plugin cache (`getPluginCache()`): it is shared
 * by all MCP clients, REST calls and widgets of the same user on this plugin. With the default
 * in-memory cache a selection lasts until the server instance restarts; inject a durable cache
 * with `setPluginCache()` to keep it across restarts and instances.
 * @experimental Part of the experimental Quartal Hub services; the API may change.
 */
export class HubCompanies {
  /**
   * @param iam Client for the Quartal IAM API, authenticated as the current user.
   * @param uid The current user's id (the token's `sub`); keys the selected company.
   */
  constructor(
    private readonly iam: HubApiClient,
    private readonly uid: string | undefined,
  ) {}

  /**
   * The companies the current user is linked to, one row per company, by name.
   * @param options Optional filters.
   * @returns The user's companies.
   * @example
   * ```ts
   * const hub = getExperimentalHubContext(ctx);
   * const own = await hub.companies.list({ via: "direct" });
   * ```
   */
  async list(options: {
    /** `direct` (own memberships), `team` (reached only as customers of the user's Advisories) or `all` (default). */
    via?: "direct" | "team" | "all";
    /** Partial, case-insensitive match on the company name. */
    name?: string;
    /** Include each company's row dates and counts (`stats`). Default false. */
    stats?: boolean;
  } = {}): Promise<HubCompany[]> {
    const res = await this.iam.get<{ companies: HubCompany[] }>("/api/companies", options);
    return res.companies;
  }

  /**
   * One company with the current user's role and capabilities in it. The user must be linked to
   * the company; otherwise the service refuses the call (`HubApiError` with status 403).
   * @param companyId Quartal IAM id of the company.
   * @returns The company, the user's direct role and what the user may do in it.
   */
  get(companyId: string): Promise<HubCompanyDetails> {
    return this.iam.get<HubCompanyDetails>(`/api/companies/${encodeURIComponent(companyId)}`);
  }

  /**
   * The customers of an Advisory (accounting firm). An admin of the Advisory sees all of them; a
   * member sees those covered by the teams they belong to. The user must be a direct member of
   * the Advisory; otherwise the service refuses the call (`HubApiError` with status 403).
   * @param advisoryId Quartal IAM id of the Advisory.
   * @param options Optional filters.
   * @returns The customers by name, and whether the list was cut at `limit`.
   */
  listCustomers(advisoryId: string, options: {
    /** Text the customer's name contains, or the start of its business ID (case-insensitive). */
    query?: string;
    /** Maximum number of customers to return, 1–500 (default 500). */
    limit?: number;
  } = {}): Promise<HubCustomerList> {
    return this.iam.get<HubCustomerList>(`/api/companies/${encodeURIComponent(advisoryId)}/customers`, options);
  }

  /**
   * The company the current user has selected to work in, or `null` when none is selected.
   * @returns The selected company as it was when selected.
   */
  async getSelected(): Promise<HubSelectedCompany | null> {
    return (await getPluginCache().get<HubSelectedCompany>(this.selectedKey())) ?? null;
  }

  /**
   * Selects the company the current user works in, or clears the selection with `null`. The
   * company is checked with {@link HubCompanies.get} first, so a company the user has no access
   * to is refused (`HubApiError` with status 403) and nothing is stored.
   * @param companyId Quartal IAM id of the company, or `null` to clear the selection.
   * @returns The stored selection, or `null` when cleared.
   * @example
   * ```ts
   * const hub = getExperimentalHubContext(ctx);
   * await hub.companies.setSelected(input.companyId);
   * const files = await hub.files.list("/"); // the selected company's drives
   * ```
   */
  async setSelected(companyId: string | null): Promise<HubSelectedCompany | null> {
    const key = this.selectedKey();
    if (companyId === null) {
      await getPluginCache().delete(key);
      return null;
    }
    const { company } = await this.get(companyId);
    const selected: HubSelectedCompany = {
      companyId: company.companyId,
      name: company.name,
      businessId: company.businessId,
      isAccountingFirm: company.isAccountingFirm,
      selectedAt: new Date().toISOString(),
    };
    await getPluginCache().set(key, selected, { ttlMs: SELECTED_COMPANY_TTL_MS });
    return selected;
  }

  private selectedKey(): [string, string] {
    if (!this.uid) {
      throw new Error("The selected company needs a signed-in user with a user id (the token's `sub`).");
    }
    return ["qrtl_hub_selected_company", this.uid];
  }
}
