import type { Address, CompanyForm, CompanySituation, RegisteredEntry, RegisterName } from "./Company.ts";
import type { PublicNotice } from "./PublicNotice.ts";

/**
 * Company data as returned by the KREK (registered notices) API. Same shape as the
 * YTJ `Company` minus `mainBusinessLine` / `website`, plus the `publicNotices` array.
 */
export interface NoticesCompany {
  /** Business ID block (Y-tunnus). */
  businessId?: {
    /** Business ID in canonical `NNNNNNN-C` form. */
    value: string;
    /**
     * Date the business ID was issued.
     * @format date
     */
    registrationDate?: string | null;
    /** PRH TLAHDE code for the data source. */
    source: string;
  };
  /** EUID block — pan-European Unique Identifier. */
  euId?: {
    /** EUID code, e.g. `FIFPRO.0116297-6`. */
    value: string;
    /** PRH TLAHDE code for the data source. */
    source: string;
  };
  /** All registered names. Version 1 is current. */
  names?: RegisterName[];
  /** Current and (optionally) previous company form (YRMU). */
  companyForms?: CompanyForm[];
  /** Active special situations. */
  companySituations?: CompanySituation[];
  /** Register entries. */
  registeredEntries?: RegisteredEntry[];
  /** Visit (type=1) and mailing (type=2) addresses. */
  addresses?: Address[];
  /** All registered public notices in reverse chronological order. */
  publicNotices?: PublicNotice[];
  /** Trade register status code (REK_KDI). */
  tradeRegisterStatus?: string;
  /** Business ID status code (STATUS3). */
  status?: string;
  /**
   * Original company registration date.
   * @format date
   */
  registrationDate?: string | null;
  /**
   * Liquidation / cease date if the company has ended.
   * @format date
   */
  endDate?: string | null;
  /** Last modification timestamp (`yyyy-MM-dd HH:mm:ss`, no time zone). */
  lastModified?: string;
}
