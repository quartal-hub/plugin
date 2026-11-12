import type { QuartalPluginContext } from "@quartal/plugin-core";
import type { AddAdminSummary } from "./model/AddAdminSummary.ts";
import type { AddCompanyResult } from "./model/AddCompanyResult.ts";
import type { Company } from "./model/Company.ts";
import type { CompanyAvatar } from "./model/CompanyAvatar.ts";
import type { CompanyMember } from "./model/CompanyMember.ts";
import type { CompanyOverview } from "./model/CompanyOverview.ts";
import type { CustomerOverview } from "./model/CustomerOverview.ts";
import type { Edge } from "./model/Edge.ts";
import type { Team } from "./model/Team.ts";
import type { TeamDetail } from "./model/TeamDetail.ts";
import type { UserHit } from "./model/UserHit.ts";
import { notImplemented } from "./notImplemented.ts";

/** A company as the operator sees it: the directory row with its connected-service details. */
export interface OperatorCompany extends Company {
  /** The company's identifiers and details in connected services, e.g. `salaxy.accountId`. */
  attributes: { [key: string]: unknown };
  /** Salaxy account id (IBAN format, no spaces); null when unknown. */
  salaxyAccountId: string | null;
  avatar: CompanyAvatar;
  /** ISO timestamps of the company row. */
  createdAt: string;
  updatedAt: string;
}

/**
 * Operation of the whole directory by the platform operator: The realm-wide business Admin (as opposed to company admin or technical Keycloak admin).
 * Requires `platform-operator` role in a token issued to the `quartal-operator` client; otherwise it is
 * refused (403). Changes keep history (memberships and mandates are ended, never deleted) and
 * are audited under the operator. TODO: May be moved as a separate service.
 * @mcp hidden
 */
export class Operator {
  /**
   * Companies across the whole directory, with their member, admin, team and mandate counts.
   * @summary /api/Operator/companies
   * @param input Search text, filters and paging; all optional.
   * @returns One page of companies, advisors first and then by name, and the total count.
   */
  static async findCompanies(
    input: {
      /** Text the company name contains, or the start of its business ID. */
      query?: string;
      /** Only advisors (accounting firms). */
      firmsOnly?: boolean;
      /** Only client companies (not advisors). */
      clientsOnly?: boolean;
      /** Only companies that currently have no admin. */
      withoutAdmin?: boolean;
      /** Page size, 1–200 (default 50). */
      limit?: number;
      /** Number of companies to skip (default 0). */
      offset?: number;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ companies: CompanyOverview[]; total: number }> {
    throw notImplemented("Operator.findCompanies");
  }

  /**
   * One company: its details, its members, its teams with their members and mandates, and the
   * advisors whose teams hold a mandate over it.
   * @summary /api/Operator/company
   * @rest GET companies/{companyId}
   * @param input The company.
   * @returns The company with its members, teams and managing advisors.
   */
  static async getCompanyDetails(
    input: {
      /** Directory id of the company. */
      companyId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{
    company: OperatorCompany;
    members: CompanyMember[];
    teams: TeamDetail[];
    managedBy: { firmId: string; firmName: string; teamId: string; teamName: string }[];
  }> {
    throw notImplemented("Operator.getCompanyDetails");
  }

  /**
   * Changes a company's name and the avatar shown for it (initials and colour). Fields left out
   * stay as they are; an empty initials or colour clears it.
   * @summary /api/Operator/updateCompany
   * @rest companies/{companyId}
   * @param input The company and the fields to change.
   * @returns The updated company.
   */
  static async updateCompany(
    input: {
      /** Directory id of the company. */
      companyId: string;
      /** The new name. */
      name?: string;
      /** Up to four characters shown on the avatar when the company has no picture. */
      initials?: string;
      /** The avatar's background colour: a hex value (`#1a73e8`) or a CSS colour name. */
      color?: string;
      /** URL (https) of the avatar picture, shown instead of the initials and colour. */
      url?: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<OperatorCompany> {
    throw notImplemented("Operator.updateCompany");
  }

  /**
   * TEST SERVERS ONLY. Deletes a company from the directory completely, with its memberships,
   * the mandates over it and the teams it owns. Deletions are not reported by
   * `Directory.listChanges`.
   * @summary /api/Operator/deleteCompany
   * @rest companies/{companyId}
   * @param input The company.
   * @returns What was deleted along with the company.
   */
  static async removeCompany(
    input: {
      /** Directory id of the company. */
      companyId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ members: number; mandates: number; teams: number }> {
    throw notImplemented("Operator.removeCompany");
  }

  /**
   * The customers of an advisor: every company its teams hold a mandate over, with those
   * mandates. Searchable and paged.
   * @summary /api/Operator/customers
   * @rest GET companies/{companyId}/customers
   * @readOnly
   * @param input The advisor, search text and paging.
   * @returns One page of customers by name, each with the advisor's mandates over it, and the total count.
   */
  static async searchCustomers(
    input: {
      /** Directory id of the advisor. */
      companyId: string;
      /** Text the customer's name contains, or the start of its business ID. */
      query?: string;
      /** Page size, 1–200 (default 50). */
      limit?: number;
      /** Number of customers to skip (default 0). */
      offset?: number;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ customers: CustomerOverview[]; total: number }> {
    throw notImplemented("Operator.searchCustomers");
  }

  /**
   * Makes a company a customer of an advisor: one of the advisor's teams gets a mandate over it,
   * valid from today. Without a team the advisor's `Asiakkaat` team is used, created when missing.
   * @summary /api/Operator/addCustomer
   * @rest companies/{companyId}/customers
   * @param input The advisor, the customer and optionally the team.
   * @returns The team holding the new mandate, and the mandate.
   */
  static async createCustomer(
    input: {
      /** Directory id of the advisor. */
      companyId: string;
      /** Directory id of the customer company. */
      clientCompanyId: string;
      /** Directory id of one of the advisor's live teams; defaults to its `Asiakkaat` team. */
      teamId?: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ team: Team; mandate: Edge }> {
    throw notImplemented("Operator.createCustomer");
  }

  /**
   * Ends every mandate the advisor's teams hold over a customer, as of today; the advisor's
   * access to the customer through its teams stops immediately.
   * @summary /api/Operator/removeCustomer
   * @rest companies/{companyId}/customers/{clientCompanyId}
   * @param input The advisor and the customer.
   * @returns The ended mandates with their `validTo`.
   */
  static async removeCustomer(
    input: {
      /** Directory id of the advisor. */
      companyId: string;
      /** Directory id of the customer company. */
      clientCompanyId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ ended: Edge[] }> {
    throw notImplemented("Operator.removeCustomer");
  }

  /**
   * Users of the caller's realm matching a query, to pick a new member of a company from.
   * @summary /api/Operator/searchUsers
   * @rest GET companies/{companyId}/users
   * @param input The company and the query.
   * @returns The matching users, each marked with their directory person and whether they are already a member.
   */
  static async findUsers(
    input: {
      /** Directory id of the company. */
      companyId: string;
      /** Text to match against the user's name, user name and e-mail; at least 2 characters. */
      query: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ users: UserHit[] }> {
    throw notImplemented("Operator.findUsers");
  }

  /**
   * Makes a user of the caller's realm a member of a company, valid from today. A user the
   * directory does not know yet gets a directory person, with the name and e-mail of their
   * user account.
   * @summary /api/Operator/addMember
   * @rest companies/{companyId}/members
   * @param input The company, the user and the role.
   * @returns The new membership.
   */
  static async createCompanyMember(
    input: {
      /** Directory id of the company. */
      companyId: string;
      /** User id, from `findUsers`. */
      userId: string;
      /** The role in the company: `admin` or `member`. */
      role: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<CompanyMember> {
    throw notImplemented("Operator.createCompanyMember");
  }

  /**
   * Changes a member's role. The current membership is ended and a new one opened, so the
   * membership id changes.
   * @summary /api/Operator/setRole
   * @rest members/{membershipId}/role
   * @param input The membership and the new role.
   * @returns The new membership (unchanged when the role is already the one asked for).
   */
  static async updateCompanyMemberRole(
    input: {
      /** Id of the membership, from `getCompanyDetails`. */
      membershipId: string;
      /** The new role in the company: `admin` or `member`. */
      role: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<CompanyMember> {
    throw notImplemented("Operator.updateCompanyMemberRole");
  }

  /**
   * Ends a membership as of today; the member's access stops immediately.
   * @summary /api/Operator/endMember
   * @rest members/{membershipId}
   * @param input The membership to end.
   * @returns The ended membership with its `validTo`.
   */
  static async removeCompanyMember(
    input: {
      /** Id of the membership, from `getCompanyDetails`. */
      membershipId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Edge> {
    throw notImplemented("Operator.removeCompanyMember");
  }

  /**
   * Creates a team for an advisor.
   * @summary /api/Operator/createTeam
   * @rest companies/{ownerCompanyId}/teams
   * @param input The advisor and the team name.
   * @returns The created team.
   */
  static async createCompanyTeam(
    input: {
      /** Directory id of the advisor that owns the team. */
      ownerCompanyId: string;
      /** Name of the team. */
      name: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Team> {
    throw notImplemented("Operator.createCompanyTeam");
  }

  /**
   * Renames a team.
   * @summary /api/Operator/renameTeam
   * @rest PUT teams/{teamId}
   * @idempotent
   * @param input The team and its new name.
   * @returns The updated team.
   */
  static async renameTeam(
    input: {
      /** Directory id of the team. */
      teamId: string;
      /** The new name. */
      name: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Team> {
    throw notImplemented("Operator.renameTeam");
  }

  /**
   * Archives a team: every current membership and mandate ends today and the team disappears
   * from the advisor's teams. History is kept.
   * @summary /api/Operator/archiveTeam
   * @rest teams/{teamId}/archive
   * @param input The team to archive.
   * @returns The archived team.
   */
  static async archiveTeam(
    input: {
      /** Directory id of the team. */
      teamId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Team> {
    throw notImplemented("Operator.archiveTeam");
  }

  /**
   * Adds a person to a team, valid from today. The person must be a current member of the
   * advisor that owns the team.
   * @summary /api/Operator/addTeamMember
   * @rest teams/{teamId}/members
   * @param input The team and the person.
   * @returns The new team membership.
   */
  static async createTeamMember(
    input: {
      /** Directory id of the team. */
      teamId: string;
      /** Directory person id of a current member of the advisor that owns the team. */
      personId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Edge> {
    throw notImplemented("Operator.createTeamMember");
  }

  /**
   * Ends a team membership as of today; the person's access through the team stops immediately.
   * @summary /api/Operator/endTeamMember
   * @rest team-members/{membershipId}
   * @param input The membership to end.
   * @returns The ended membership with its `validTo`.
   */
  static async removeTeamMember(
    input: {
      /** Id of the team membership, from `getCompanyDetails` or `createTeamMember`. */
      membershipId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Edge> {
    throw notImplemented("Operator.removeTeamMember");
  }

  /**
   * Gives a team a mandate over a client company, valid from today. A team cannot hold a
   * mandate over its own advisor.
   * @summary /api/Operator/addMandate
   * @rest teams/{teamId}/mandates
   * @param input The team and the client company.
   * @returns The new mandate.
   */
  static async createTeamMandate(
    input: {
      /** Directory id of the team. */
      teamId: string;
      /** Directory id of the client company. */
      clientCompanyId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Edge> {
    throw notImplemented("Operator.createTeamMandate");
  }

  /**
   * Ends a team's mandate over a client company as of today; the team's access to the company
   * stops immediately.
   * @summary /api/Operator/endMandate
   * @rest mandates/{mandateId}
   * @param input The mandate to end.
   * @returns The ended mandate with its `validTo`.
   */
  static async removeTeamMandate(
    input: {
      /** Id of the mandate, from `getCompanyDetails`, `searchCustomers` or `createTeamMandate`. */
      mandateId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Edge> {
    throw notImplemented("Operator.removeTeamMandate");
  }

  /**
   * Adds a company to the directory from Salaxy by its Salaxy account id: the company and, for
   * an advisor, its customers (into its `Asiakkaat` team) are added when missing and refreshed
   * when present. Nobody is linked to the company: give it an admin with `addAdmin` or
   * `createCompanyMember`. Unverified Salaxy accounts and accounts without a business id are skipped.
   * @summary /api/Operator/addCompany
   * @rest companies/from-salaxy
   * @param input The Salaxy account id of the company.
   * @returns The company and what happened to its customers.
   */
  static async createCompanyFromSalaxy(
    input: {
      /** Salaxy account id of the company (IBAN format, spaces allowed). */
      salaxyAccountId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<AddCompanyResult> {
    throw notImplemented("Operator.createCompanyFromSalaxy");
  }

  /**
   * Makes an existing user of the caller's realm an admin of a company, typically the first
   * admin of a new advisor. Safe to repeat: an admin stays an admin, a member is promoted. The
   * change is audited with the operator.
   * @summary /api/Operator/addAdmin
   * @param input The user's e-mail, the company's business ID and, to create a missing company
   *   as an advisor, its name.
   * @returns The company and what happened to the user's membership.
   */
  static async addAdmin(
    input: {
      /** E-mail of an existing user of the caller's realm. */
      email: string;
      /** Business ID (Y-tunnus) of the company. */
      businessId: string;
      /** Name for the company when it does not exist yet; it is then created as an advisor. Without it a missing company is an error. */
      companyName?: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<AddAdminSummary> {
    throw notImplemented("Operator.addAdmin");
  }
}
