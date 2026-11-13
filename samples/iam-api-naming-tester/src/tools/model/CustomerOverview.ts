import type { Company } from "./Company.ts";
import type { CompanyAvatar } from "./CompanyAvatar.ts";

/** A customer of an advisor with the advisor's mandates over it. */
export interface CustomerOverview extends Company {
  /** Salaxy account id (IBAN format, no spaces); null when unknown. */
  salaxyAccountId: string | null;
  avatar: CompanyAvatar;
  /** The open mandates of the advisor's live teams over this customer. */
  mandates: {
    /** Id of the mandate. */
    id: string;
    /** Directory id of the team holding it. */
    teamId: string;
    teamName: string;
    /** First day of the mandate (YYYY-MM-DD). */
    validFrom: string;
  }[];
}
