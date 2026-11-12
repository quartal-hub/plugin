/**
 * The company the current user has selected to work in, stored by `HubCompanies.setSelected()`.
 * Tools use it as the default company, e.g. the default `owner` of `HubFiles` calls.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubSelectedCompany {
  /** Quartal IAM (directory) id of the company. */
  companyId: string;
  /** Display name of the company when it was selected. */
  name: string;
  /** Business ID (Y-tunnus), when known. */
  businessId: string | null;
  /** The company is an Advisory (accounting firm). */
  isAccountingFirm: boolean;
  /** When the company was selected (ISO 8601). */
  selectedAt: string;
}
