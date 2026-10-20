import type { QuartalPluginContext } from "@quartal/plugin-core";
import type { CompanyCapabilities } from "./model/CompanyCapabilities.ts";
import { notImplemented } from "./notImplemented.ts";

/** A company the caller is linked to, directly or through a team mandate. */
export interface MyCompany {
  /** Directory id of the company. */
  companyId: string;
  name: string;
  /** Business ID (Y-tunnus), when known. */
  businessId: string | null;
  /** An advisor (accounting firm): has customers and teams. */
  isAccountingFirm: boolean;
  /** The caller's role through a direct membership (`admin` or `member`); null when the only link is a team mandate. */
  role: string | null;
  /** How the caller is linked: a direct membership, or a mandate held by an advisor's team. */
  via: "direct" | "team";
  /** For `via: "team"`: the advisor whose team holds the mandate. */
  firmName: string | null;
  /** Salaxy account id (IBAN format, no spaces); null when unknown. */
  salaxyAccountId: string | null;
  /** Salaxy avatar: colour (CSS), initials and picture url, when known. */
  avatar: { color: string | null; initials: string | null; url: string | null };
  /** When the company was added to the directory (ISO 8601 timestamp). */
  createdAt: string;
  /** When the company was last changed in the directory (ISO 8601 timestamp). */
  updatedAt: string;
  /** Current direct members. */
  memberCount: number;
  /** Live teams (advisors only; 0 otherwise). */
  teamCount: number;
  /** Customers under a mandate (advisors only; 0 otherwise). */
  customerCount: number;
}

/** A company as the directory knows it. */
export interface CompanyInfo {
  /** Directory id of the company. */
  companyId: string;
  name: string;
  /** Business ID (Y-tunnus), when known. */
  businessId: string | null;
  /** An advisor (accounting firm): has customers and teams. */
  isAccountingFirm: boolean;
  /** Salaxy account id (IBAN format, no spaces); null when unknown. */
  salaxyAccountId: string | null;
  /** The company's identifiers and details in connected services, e.g. `salaxy.accountId`. */
  attributes: { [key: string]: unknown };
}

/** A customer of an advisor. */
export interface Customer {
  /** Directory id of the customer company. */
  companyId: string;
  name: string;
  /** Business ID (Y-tunnus), when known. */
  businessId: string | null;
  /** The customer is itself an advisor (accounting firm). */
  isAccountingFirm: boolean;
  /** Salaxy account id (IBAN format, no spaces); null when unknown. */
  salaxyAccountId: string | null;
}

/**
 * The companies the caller is linked to: their own companies and the customers of the advisors
 * they work for, what the caller may do in each, and adding or removing a company. A caller is
 * linked to a company either directly (a membership with a role) or through a team of an advisor
 * (a mandate). Access is always resolved from the directory, never from the roles in the
 * caller's token.
 */
export class Companies {
  /**
   * The companies the caller is linked to, one row per company: Both direct memberships and team mandates.
   * @summary [/api/Companies/mine] Lists all the companies available for the caller.
   * @param input Optional filters.
   * @returns The caller's companies, by name.
   */
  static async list(
    input: {
      /** `direct` (own memberships), `team` (reached only through an advisor's team: its customers) or `all` (default). */
      via?: "direct" | "team" | "all";
      /** Partial, case-insensitive match on the company name (the one shown in the lists). */
      name?: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ companies: MyCompany[] }> {
    throw notImplemented("Companies.list");
  }

  /**
   * Gets a single company by id.
   * One company: what the directory knows of it, the caller's direct role there, and what the
   * caller may do in it. The caller must be linked to the company (a direct membership, a team
   * mandate, or being an admin of an advisor whose team holds a mandate over it); otherwise the
   * call is refused (403).
   * @summary [/api/Companies/get] Gets a single company by id.
   * @param input The company.
   * @returns The company, the caller's direct role (null when the link is a mandate) and the capabilities.
   */
  static async getCompany(
    input: {
      /** Directory id of the company. */
      id: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ company: CompanyInfo; role: string | null; capabilities: CompanyCapabilities }> {
    throw notImplemented("Companies.get");
  }

  /**
   * The customers of a single advisor: the companies its teams hold a mandate over.
   * An admin of the advisor sees all of them; a member sees only those covered by the teams they belong to.
   * The caller must be a direct member of the advisor; otherwise the call is refused (403).
   * @summary [/api/Companies/customers] Lists the customers of an advisory.
   * @rest GET {id}/customers
   * @param input The advisor.
   * @returns The customers, by name.
   */
  static async listCustomers(
    input: {
      /** Directory id of the advisor. */
      id: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ customers: Customer[] }> {
    throw notImplemented("Companies.listCustomers");
  }

  /**
   * Removes a company from the list of companies.
   * If the company s directly linked to the current user, removes the direct membership.
   * If the company is a customer linked to an Advisory, removes completely from the Advisory and requires Admin role to Advisory.
   * Company remains in the directory. Currently, the last admin of a company cannot remove their own access (403): make another member admin first. History is kept.
   * @summary [/api/Companies/removeAccess] Removes a company from user or Advisory.
   * @param input The company.
   * @returns How many memberships and mandates ended.
   */
  static async deleteCompany(
    input: {
      /** Directory id of the company. */
      id: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ endedMemberships: number; endedMandates: number }> {
    throw notImplemented("Companies.removeAccess");
  }
}
