/**
 * One company with the current user's role and capabilities in it, as returned by
 * `HubCompanies.get()`.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubCompanyDetails {
  /** What the directory knows of the company. */
  company: {
    /** Quartal IAM (directory) id of the company. */
    companyId: string;
    /** Display name of the company. */
    name: string;
    /** Business ID (Y-tunnus), when known. */
    businessId: string | null;
    /** The company is an Advisory (accounting firm). */
    isAccountingFirm: boolean;
    /** Salaxy account id (IBAN format, no spaces), when known. */
    salaxyAccountId: string | null;
    /** The company's identifiers and details in connected services, e.g. `salaxy.accountId`. */
    attributes: Record<string, unknown>;
  };
  /** The user's direct role (`admin` / `member`), or `null` when the link is through an Advisory. */
  role: string | null;
  /** What the user may do in the company. */
  capabilities: {
    /** Manage the company's members. */
    members: boolean;
    /** Manage teams (Advisories only). */
    teams: boolean;
    /** List the company's customers (Advisories only). */
    customers: boolean;
    /** Create tokens / act as the company. */
    tokens: boolean;
    /** Delete the company (test environments only). */
    delete: boolean;
  };
}
