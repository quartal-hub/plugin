/** One company a person may act for, and how they are linked to it. */
export interface Access {
  /** Directory id of the company. */
  companyId: string;
  name: string;
  /** Business ID (Y-tunnus), when known. */
  businessId: string | null;
  /** An advisor (accounting firm): has customers and teams. */
  isAccountingFirm: boolean;
  /** The company's identifiers and details in connected services, e.g. `salaxy.accountId`. */
  attributes: { [key: string]: unknown };
  /** The person's role in the company through a direct membership (`admin` or `member`); null for a team mandate. */
  role: string | null;
  /** How the person is linked: a direct membership, or a mandate held by an advisor's team. */
  via: "direct" | "team";
  /** For `via: "team"`: the team holding the mandate. Null for a direct membership. */
  team: { id: string; name: string } | null;
  /** For `via: "team"`: the advisor that owns the team. Null for a direct membership. */
  firm: { id: string; name: string; businessId: string | null } | null;
  /** Salaxy account id of the company (IBAN format, no spaces); null when unknown. */
  salaxyAccountId: string | null;
}
