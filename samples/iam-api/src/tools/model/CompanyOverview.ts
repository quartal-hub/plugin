import type { Company } from "./Company.ts";
import type { CompanyAvatar } from "./CompanyAvatar.ts";

/** A company with its member, admin, team and mandate counts. */
export interface CompanyOverview extends Company {
  /** Current members. */
  members: number;
  /** Current members with the `admin` role. */
  admins: number;
  /** Live teams. */
  teams: number;
  /** Open mandates held by the company's teams over client companies. */
  mandates: number;
  /** Open mandates other firms' teams hold over this company. */
  managedBy: number;
  /** Salaxy account id (IBAN format, no spaces); null when unknown. */
  salaxyAccountId: string | null;
  avatar: CompanyAvatar;
  /** ISO timestamps of the company row. */
  createdAt: string;
  updatedAt: string;
}
