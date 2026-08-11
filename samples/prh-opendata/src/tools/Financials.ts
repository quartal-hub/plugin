import type { BusinessIdInput } from "./model/BusinessIdInput.ts";
import type { Financial, FinancialResult } from "./model/Financial.ts";
import type { FinancialStatementInput, FinancialStatementResult } from "./model/FinancialStatementInput.ts";
import type { ListFinancialFilersInput } from "./model/ListFinancialFilersInput.ts";
import { buildPrhUrl, fetchPrhJson, fetchPrhText, PRH_BASES, PrhFetchError } from "./util/prhFetch.ts";
import { formatBusinessIdFi } from "./util/validation.ts";

/**
 * Digital financial statements (XBRL) for Finnish companies.
 * Wraps https://avoindata.prh.fi/fi/xbrl/swagger-ui.
 *
 * Less than 10 % of Finnish companies file via XBRL today (introduced 2023). For an
 * arbitrary business ID, expect `getFinancialPeriods` to return an empty list more
 * often than not. Use `listFilers` to find companies that *have* filed when
 * demoing the system.
 */
export class Financials {
  /**
   * Lists all financial periods for which the given business ID has a digital
   * statement on file. Returns an empty list if the company has not filed XBRL.
   *
   * @summary List XBRL financial periods filed by a company.
   * @param input The company's business ID.
   * @returns Filings (most recent first as PRH orders them) for the company.
   */
  static async getFinancialPeriods(input: BusinessIdInput): Promise<Financial[]> {
    const businessId = formatBusinessIdFi(input.businessId);
    if (!businessId) {
      throw new Error(`Invalid Finnish business ID: ${input.businessId}`);
    }
    const url = buildPrhUrl(PRH_BASES.xbrl, "/financials", { businessId });
    try {
      const result = await fetchPrhJson<FinancialResult>(url);
      return result?.financials ?? [];
    } catch (error) {
      if (error instanceof PrhFetchError && error.status === 400) {
        // PRH returns 400 when there are simply no filings for the company.
        return [];
      }
      throw error;
    }
  }

  /**
   * Fetches one XBRL filing as the raw XML payload returned by PRH. To know which
   * `financialDate` values are valid, call `getFinancialPeriods` first.
   *
   * Parsing the XBRL XML into structured values is out of scope here — that requires
   * the official Finnish XBRL taxonomy. See https://avoindata.prh.fi/fi/info/swagger-ui
   * for taxonomy references and parser libraries.
   *
   * @summary Fetch one XBRL financial statement (raw XML).
   * @param input Business ID + period end date.
   * @returns The XML payload wrapped with its identifying business ID and date, or `null` if PRH has no such filing.
   */
  static async getFinancialStatement(input: FinancialStatementInput): Promise<FinancialStatementResult | null> {
    const businessId = formatBusinessIdFi(input.businessId);
    if (!businessId) {
      throw new Error(`Invalid Finnish business ID: ${input.businessId}`);
    }
    const url = buildPrhUrl(PRH_BASES.xbrl, "/financial", {
      businessId,
      financialDate: input.financialDate,
    });
    const xml = await fetchPrhText(url);
    if (xml === null) return null;
    return { businessId, financialDate: input.financialDate, xbrlXml: xml };
  }

  /**
   * Demo helper: lists companies that have filed XBRL statements.
   * Useful because only less than 10 % of Finnish companies use XBRL as of 2026: You may use this method to find such companies.
   *
   * Pass `financialDate` to filter by a specific financial period end (e.g. `2023-12-31`),
   * or a `registeredDateStart` / `registeredDateEnd` window to filter based on when they filed.
   *
   * If no filter is given, defaults to **the last 12 months** of registered filings.
   *
   * @summary List companies that filed XBRL statements.
   * @param input Filters and pagination.
   * @returns Paginated filings (each entry includes `businessId` + `financialDate`).
   */
  static async listFilers(input: ListFinancialFilersInput): Promise<FinancialResult> {
    const hasFinancialDate = !!input.financialDate;
    let { registeredDateStart, registeredDateEnd } = input;
    if (!hasFinancialDate && !registeredDateStart && !registeredDateEnd) {
      const today = new Date();
      const start = new Date(today);
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      registeredDateEnd = today.toISOString().slice(0, 10);
      registeredDateStart = start.toISOString().slice(0, 10);
    }
    const useStatements = !!(registeredDateStart || registeredDateEnd);
    const path = useStatements ? "/all_financial_statements" : "/all_financials";
    const query = useStatements
      ? { registeredDateStart, registeredDateEnd, page: input.page }
      : { financialDate: input.financialDate, page: input.page };
    const url = buildPrhUrl(PRH_BASES.xbrl, path, query);
    const result = await fetchPrhJson<FinancialResult>(url);
    return result ?? { totalResults: 0, financials: [] };
  }
}
