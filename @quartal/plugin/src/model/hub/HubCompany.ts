import type { HubCompanyAvatar } from "./HubCompanyAvatar.ts";

/**
 * A company the current user is linked to, as listed by `HubCompanies.list()`: either directly
 * (a membership with a role) or as a customer of an Advisory (accounting firm) whose team the user
 * belongs to.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubCompany {
  /** Quartal IAM (directory) id of the company. Also the `owner` of the company's files. */
  companyId: string;
  /** Display name of the company. */
  name: string;
  /** Business ID (Y-tunnus), when known. */
  businessId: string | null;
  /** The company is an Advisory (accounting firm): it has customers and teams. */
  isAccountingFirm: boolean;
  /** How the user reaches the company: a direct membership, or only through an Advisory's team. */
  via: "direct" | "team";
  /** The user's direct membership, or `null` when the company is reached only through an Advisory. */
  direct: {
    /** The user's role in the company: `admin` or `member`. */
    role: string;
    /** Id of the membership. */
    membershipId: string;
    /** First day of the membership (YYYY-MM-DD). */
    validFrom: string;
  } | null;
  /** The Advisories through which the user reaches the company as one of its customers. */
  advisories: Array<{
    /** Quartal IAM id of the Advisory. */
    companyId: string;
    /** Display name of the Advisory. */
    name: string;
    /** Business ID (Y-tunnus) of the Advisory, when known. */
    businessId: string | null;
    /** The Advisory's teams the user belongs to that give the access. */
    teams: Array<{ id: string; name: string }>;
  }>;
  /** Salaxy account id (IBAN format, no spaces), when known. */
  salaxyAccountId: string | null;
  /** The company's avatar. */
  avatar: HubCompanyAvatar;
  /** Row dates and counts; present only when the list was requested with `stats: true`. */
  stats: {
    /** When the company was added to the directory (ISO 8601). */
    createdAt: string;
    /** When the company was last changed in the directory (ISO 8601). */
    updatedAt: string;
    /** Current direct members. */
    members: number;
    /** Live teams (Advisories only). */
    teams: number;
    /** Customers under a mandate (Advisories only). */
    customers: number;
  } | null;
}
