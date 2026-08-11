import type { CompanyResult } from "./model/CompanyResult.ts";
import type { FindCompaniesInput } from "./model/FindCompaniesInput.ts";
import type { SearchCompaniesInput } from "./model/SearchCompaniesInput.ts";
import type { SearchCompaniesResult } from "./model/SearchCompaniesResult.ts";
import { buildPrhUrl, fetchPrhJson, PRH_BASES } from "./util/prhFetch.ts";
import { summarizeCompany } from "./util/summarize.ts";
import { formatBusinessIdFi, isBusinessIdFi } from "./util/validation.ts";

/**
 * Company register (YTJ) lookups. Wraps the PRH YTJ Open Data API at
 * https://avoindata.prh.fi/fi/ytj/swagger-ui.
 *
 * `searchCompanies` is the primary MCP tool: a single-field search that auto-detects
 * business IDs. `findCompanies` is the power-user multi-criteria variant.
 *
 * The `/all_companies` daily ZIP dump is intentionally not exposed (too large for a
 * synchronous tool call), and PRH's `/description` + `/post_codes` endpoints are also
 * not exposed as MCP tools — code descriptions that the agent actually needs are
 * fetched internally and merged into the response (see `Notices.getCompanyNotices`).
 * @summary Company register (YTJ) lookups.
 */
export class Companies {
  /**
   * One-shot company search. Auto-detects whether `query` is a Finnish business ID
   * (Y-tunnus, with checksum) and routes it to an exact lookup; otherwise treats it as
   * a partial name match. Returns a compact {@link CompanySummary} list suited for
   * confirming a match with the user or prefilling a customer/supplier record.
   *
   * @summary Search companies by name or business ID.
   * @param input The search query.
   * @returns Detected mode plus up to 100 summarized matches.
   * @example
   * ```ts
   * await Companies.searchCompanies({ query: "0116297-6" });
   * await Companies.searchCompanies({ query: "Quartal" });
   * ```
   */
  static async searchCompanies(input: SearchCompaniesInput): Promise<SearchCompaniesResult> {
    const raw = (input.query ?? "").trim();
    if (!raw) {
      return { mode: "empty", totalResults: 0, companies: [] };
    }
    const lang = input.lang ?? "fi";
    const isId = isBusinessIdFi(raw);
    const result = await Companies.findCompanies(
      isId ? { businessId: formatBusinessIdFi(raw)! } : { name: raw },
    );
    return {
      mode: isId ? "businessId" : "name",
      totalResults: result.totalResults,
      companies: result.companies.map((c) => summarizeCompany(c, lang)),
    };
  }

  /**
   * Full PRH YTJ search with every supported filter. Use this when an agent or user
   * needs to combine criteria (name + post code, industry + date range, etc.). Returns
   * the raw {@link CompanyResult} from PRH so all fields are accessible.
   *
   * @summary Multi-criteria company search (raw PRH YTJ response).
   * @param input Any combination of PRH `/companies` query parameters.
   * @returns Paginated companies envelope.
   */
  static async findCompanies(input: FindCompaniesInput): Promise<CompanyResult> {
    const businessId = input.businessId ? formatBusinessIdFi(input.businessId) ?? input.businessId : undefined;
    const url = buildPrhUrl(PRH_BASES.ytj, "/companies", {
      name: input.name,
      businessId,
      location: input.location,
      postCode: input.postCode,
      companyForm: input.companyForm,
      mainBusinessLine: input.mainBusinessLine,
      registrationDateStart: input.registrationDateStart,
      registrationDateEnd: input.registrationDateEnd,
      businessIdRegistrationStart: input.businessIdRegistrationStart,
      businessIdRegistrationEnd: input.businessIdRegistrationEnd,
      page: input.page,
    });
    const result = await fetchPrhJson<CompanyResult>(url);
    return result ?? { totalResults: 0, companies: [] };
  }
}
