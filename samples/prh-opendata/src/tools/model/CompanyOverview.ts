import type { Company } from "./Company.ts";
import type { Financial } from "./Financial.ts";
import type { PublicNotice } from "./PublicNotice.ts";

/**
 * Combined "everything PRH knows about this company" snapshot. Returned by
 * `CompanyOverview.getCompanyOverview`. Each section is independently nullable — for
 * example a brand new sole proprietor will typically have YTJ data but no XBRL
 * filings and no notices.
 */
export interface CompanyOverviewResult {
  /** Business ID in canonical `NNNNNNN-C` form (the lookup key). */
  businessId: string;
  /** Compact display name for the company (current main name, or `null` if PRH had no record). */
  displayName: string | null;
  /** Full YTJ company record, or `null` if the company is not in YTJ. */
  info: Company | null;
  /**
   * Available XBRL filings (most recent first). Empty when the company hasn't filed any
   * digital statements — common, since less than 10 % of companies file via XBRL.
   */
  financials: Financial[];
  /**
   * All registered notices ordered by registration date descending. Empty when the
   * company has no KREK entries (e.g. recently registered, or the API returned 404).
   */
  notices: PublicNotice[];
  /**
   * Source-by-source upstream call status. Useful when one PRH service is temporarily
   * down — the overall call can still return whatever the other two returned.
   */
  sources: {
    /** YTJ call outcome. */
    ytj: SourceStatus;
    /** XBRL call outcome. */
    xbrl: SourceStatus;
    /** KREK call outcome. */
    krek: SourceStatus;
  };
}

/** Result of one upstream PRH call. */
export interface SourceStatus {
  /** True if the call succeeded (200 / 404 both count). */
  ok: boolean;
  /** True if PRH returned 404 / no record. */
  notFound?: boolean;
  /** Error message when `ok` is false. */
  error?: string;
}
