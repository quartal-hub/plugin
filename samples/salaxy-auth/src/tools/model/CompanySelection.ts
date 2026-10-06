import type { CurrentUser } from "./CurrentUser.ts";
import type { SalaxyCompany } from "./SalaxyCompany.ts";

/** The companies the signed-in user may work in, and which one is selected. */
export interface CompanySelection {
  /** The signed-in user, including the selected company. */
  user: CurrentUser;
  /** The companies the user may act for. */
  companies: SalaxyCompany[];
  /** `companyId` of the selected company; undefined while none is selected. */
  selectedCompanyId?: string;
}
