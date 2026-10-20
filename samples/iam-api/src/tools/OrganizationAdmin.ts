import type { QuartalPluginContext } from "@quartal/plugin-core";
import type { Company } from "./model/Company.ts";
import type { CompanyMember } from "./model/CompanyMember.ts";
import type { Edge } from "./model/Edge.ts";
import type { FirmMembership } from "./model/FirmMembership.ts";
import type { UserHit } from "./model/UserHit.ts";
import { notImplemented } from "./notImplemented.ts";

/**
 * Administration of an organization by its own admin members.
 * Every call requires the caller to be a current admin of the organization; otherwise it is refused (403).
 * Changes keep history: a membership is ended, never deleted, and every change is audited.
 */
export class OrganizationAdmin {

  /**
   * Lists the direct members (users) of an organization.
   * @summary [/api/Firm/members] Lists the direct members of an organization.
   * @rest GET {orgId}/members
   * @param input The organization.
   * @returns The organization and its users with their roles.
   */
  static async listMembers(
    input: {
      /** Organization id where caller is an admin */
      orgId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ company: Company; members: CompanyMember[] }> {
    throw notImplemented("Firms.listUsers");
  }

  /**
   * Makes a user a member of the firm, valid from today.
   * @summary [/api/Firm/addMember] Makes a user a member of the firm, valid from today.
   * @rest POST {orgId}/members
   * @param input The firm, the user and the role.
   * @returns The new membership.
   */
  static async createMember(
    input: {
      /** Organization id where caller is an admin */
      orgId: string;
      /** User id, from `findUser`. */
      userId: string;
      /** The role in the firm: `admin` or `member`. */
      role: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<CompanyMember> {
    throw notImplemented("Firms.createMember");
  }

  /**
   * Changes a member's role. The current membership is ended and a new one opened, so the
   * membership id changes. An admin cannot change their own admin role (403): another admin must.
   * @summary [/api/Firm/setRole] Changes a member's role.
   * @rest {orgId}/members/{membershipId}/role
   * @param input The membership and the new role.
   * @returns The new membership.
   */
  static async updateMemberRole(
    input: {
      /** Organization id where caller is an admin */
      orgId: string;
      /** Id of the membership, from `listMembers`. */
      membershipId: string;
      /** The new role in the firm: `admin` or `member`. */
      role: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<CompanyMember> {
    throw notImplemented("Firms.updateMemberRole");
  }

  /**
   * Ends a membership as of today; the member's access stops immediately.
   * An admin cannot end their own admin membership (403): another admin must.
   * @summary [/api/Firm/endMember] Ends a membership as of today.
   * @rest DELETE {orgId}/members/{membershipId}
   * @param input The membership to end.
   * @returns The ended membership with its `validTo`.
   */
  static async removeMember(
    input: {
      /** Organization id where caller is an admin */
      orgId: string;
      /** Id of the membership, from `listMembers`. */
      membershipId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Edge> {
    throw notImplemented("Firms.removeMember");
  }

  /**
   * Finds a user by e-mail address or user id for adding a new direct member to the organization.
   * Searches by exact `email` or `userId`, not both. The entire realm is searched.
   * @summary [/api/Firm/searchUsers] Finds a user by e-mail address or user id for adding a new direct member to the organization.
   * @rest GET {orgId}/new-member-search
   * @param input The organization and the e-mail address or the user id.
   * @returns None or one user, marked with their directory person and whether they are already a member.
   */
  static async newUserSearch(
    input: {
      /** Organization id where caller is an admin */
      orgId: string;
      /** The e-mail address of the user's account, in full. */
      email?: string;
      /** The user's id in the identity provider (the `sub` of their tokens), a UUID. */
      userId?: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ users: UserHit[] }> {
    throw notImplemented("Firms.findUser");
  }
}