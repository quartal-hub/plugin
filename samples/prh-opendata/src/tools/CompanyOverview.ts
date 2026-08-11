import { Companies } from "./Companies.ts";
import { Financials } from "./Financials.ts";
import { Notices } from "./Notices.ts";
import type { Company } from "./model/Company.ts";
import type { CompanyOverviewResult, SourceStatus } from "./model/CompanyOverview.ts";
import type { Financial } from "./model/Financial.ts";
import type { NoticesInput } from "./model/NoticesInput.ts";
import type { PublicNotice } from "./model/PublicNotice.ts";
import { pickMainName } from "./util/summarize.ts";
import { formatBusinessIdFi } from "./util/validation.ts";

/**
 * Combined PRH lookup. Fans out across YTJ (company info), XBRL (financial periods)
 * and KREK (registered notices, with code descriptions) for a single business ID
 * and merges the results.
 *
 * This is the main MCP tool when an agent needs "everything PRH knows about company X"
 * — for example before drafting a customer record or a contract preamble. All three
 * upstream calls run in parallel; per-source errors are captured in `sources.*` so a
 * single outage doesn't fail the whole call.
 */
export class CompanyOverview {
  /**
   * Looks up everything PRH knows about a single business ID and returns it as one
   * snapshot. YTJ basic info, XBRL filings (period list, NOT the XBRL XML itself),
   * and KREK registered notices (with code descriptions in the requested language)
   * are fetched in parallel.
   *
   * @summary Fetch combined PRH info, financials and notices for a business ID.
   * @param input Business ID and language for KREK notice descriptions.
   * @returns Merged overview with per-source status.
   */
  static async getCompanyOverview(input: NoticesInput): Promise<CompanyOverviewResult> {
    const businessId = formatBusinessIdFi(input.businessId);
    if (!businessId) {
      throw new Error(`Invalid Finnish business ID: ${input.businessId}`);
    }
    const lang = input.lang ?? "fi";

    const [ytj, xbrl, krek] = await Promise.all([
      runSource<Company | null>(() => Companies.findCompanies({ businessId }).then((r) => r.companies[0] ?? null)),
      runSource<Financial[]>(() => Financials.getFinancialPeriods({ businessId })),
      runSource<PublicNotice[] | null>(() => Notices.getCompanyNotices({ businessId, lang }).then((c) => c?.publicNotices ?? null)),
    ]);

    const info = ytj.ok ? ytj.value : null;
    return {
      businessId,
      displayName: info ? pickMainName(info) : null,
      info,
      financials: xbrl.ok ? (xbrl.value ?? []) : [],
      notices: krek.ok ? (krek.value ?? []) : [],
      sources: {
        ytj: ytj.status,
        xbrl: xbrl.status,
        krek: { ...krek.status, notFound: krek.ok && krek.value === null ? true : krek.status.notFound },
      },
    };
  }
}

interface SourceRun<T> {
  ok: boolean;
  value: T | null;
  status: SourceStatus;
}

async function runSource<T>(fn: () => Promise<T>): Promise<SourceRun<T>> {
  try {
    const value = await fn();
    const notFound = value === null;
    return { ok: true, value, status: { ok: true, notFound } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, value: null, status: { ok: false, error: message } };
  }
}
