import type { QuartalPluginContext } from "@quartal/plugin-core";
import type { Edge } from "./model/Edge.ts";
import type { Team } from "./model/Team.ts";
import type { TeamDetail } from "./model/TeamDetail.ts";
import { notImplemented } from "./notImplemented.ts";

/**
 * The teams of an advisor: a team belongs to one advisor, has members from among the advisor's
 * people, and holds mandates over client companies. A mandate gives the team's members access
 * to the client company for as long as both the membership and the mandate are valid. Every call requires the caller to be a current admin of the advisor that
 * owns the team; otherwise it is refused (403). Changes keep history: memberships and mandates
 * are ended, never deleted, and every change is audited.
 */
export class Teams {
  /**
   * The live teams of an advisor, each with its current members and client companies.
   * @summary /api/Teams/list
   * @param input The advisor that owns the teams.
   * @returns The teams with their members and mandates, including person and company names.
   */
  static async list(
    input: {
      /** Directory id of the owning firm. */
      ownerCompanyId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ teams: TeamDetail[] }> {
    throw notImplemented("Teams.list");
  }

  /**
   * Creates a team for an advisor.
   * @summary /api/Teams/create
   * @param input The advisor and the team name.
   * @returns The created team.
   */
  static async create(
    input: {
      /** Directory id of the advisor that owns the team. */
      ownerCompanyId: string;
      /** Name of the team. */
      name: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Team> {
    throw notImplemented("Teams.create");
  }

  /**
   * Renames a team.
   * @summary /api/Teams/update
   * @param input The team and its new name.
   * @returns The updated team.
   */
  static async update(
    input: {
      /** Directory id of the team. */
      id: string;
      /** The new name. */
      name: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Team> {
    throw notImplemented("Teams.update");
  }

  /**
   * Archives a team: every current membership and mandate ends today and the team disappears
   * from `list`. History is kept.
   * @summary /api/Teams/delete
   * @param input The team to archive.
   * @returns The archived team.
   */
  static async delete(
    input: {
      /** Team ID to delete */
      id: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Team> {
    throw notImplemented("Teams.delete");
  }

  /**
   * Adds a person to a team, valid from today. The person must be a current member of the
   * advisor that owns the team.
   * @summary /api/Teams/addMember
   * @rest POST {id}/members
   * @destructive false
   * @param input The team and the person.
   * @returns The new team membership.
   */
  static async addPersonToTeam(
    input: {
      /** Directory id of the team. */
      id: string;
      /** Directory person id of a current member of the advisor that owns the team. */
      personId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Edge> {
    throw notImplemented("Teams.addPerson");
  }

  /**
   * Gives a team a mandate over one of the advisor's customers, valid from today. The company
   * must already be a customer of the advisor, i.e. held by another of its live teams (see
   * `Firms.findCustomers`); any other company is refused as not found (404). A team cannot hold
   * a mandate over its own advisor.
   * @summary /api/Teams/addCompany
   * @rest {id}/mandates
   * @param input The team and the client company.
   * @returns The new mandate.
   */
  static async createMandate(
    input: {
      /** Directory id of the team. */
      id: string;
      /** Directory id of the client company. */
      clientCompanyId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Edge> {
    throw notImplemented("Teams.createMandate");
  }

  /**
   * Ends a team membership as of today; the person's access through the team stops immediately.
   * @summary /api/Teams/endMember
   * @rest members/{membershipId}
   * @param input The membership to end.
   * @returns The ended membership with its `validTo`.
   */
  static async removePerson(
    input: {
      /** Id of the team membership, from `addPerson` or `list`. */
      membershipId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Edge> {
    throw notImplemented("Teams.removePerson");
  }

  /**
   * Ends a team's mandate over a client company as of today; the team's access to the company
   * stops immediately.
   * @summary /api/Teams/endCompany
   * @rest mandates/{mandateId}
   * @param input The mandate to end.
   * @returns The ended mandate with its `validTo`.
   */
  static async removeMandate(
    input: {
      /** Id of the mandate, from `createMandate` or `list`. */
      mandateId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<Edge> {
    throw notImplemented("Teams.removeMandate");
  }
}
