import type { QuartalPluginContext } from "@quartal/plugin-core";
import type { Access } from "./model/Access.ts";
import type { ChangePage } from "./model/ChangePage.ts";
import { notImplemented } from "./notImplemented.ts";

/**
 * The directory as other services read it: persons, companies, teams and the relations between
 * them (memberships and mandates), each with a validity period. A service that keeps its own
 * copy replicates it from `listChanges`; `getPersonAccess` answers for the calling user alone.
 * @mcp hidden
 */
export class Directory {
  /**
   * The change feed: every directory row changed since the cursor, oldest first. Rows are never
   * deleted; a relation that ends reappears with its `valid_to` set, so replicate by upserting.
   * Requires the `directory-sync` role, granted to the service accounts of replicating services.
   * @summary /api/Directory/changes
   * 
   * @param input The cursor from the previous page (omit for a full sync) and the page size.
   * @returns A page of changes, the cursor to continue from, and whether more remain.
   */
  static async listChanges(
    input: {
      /** Opaque cursor returned by the previous call. Omit to start from the beginning. */
      since?: string;
      /** Page size, 1–5000 (default 1000). */
      limit?: number;
    },
    ctx: QuartalPluginContext,
  ): Promise<ChangePage> {
    throw notImplemented("Directory.listChanges");
  }

  /**
   * The companies the caller may currently act for: direct memberships, with their role, and
   * team mandates. Always current, never cached.
   * @summary /api/Directory/personAccess
   * @param _input No parameters.
   * @returns The caller's directory person id (null when the directory does not know them) and
   *   one row per company and link: the company with its identifiers in connected services
   *   (`attributes`, e.g. `salaxy.accountId`), whether the link is a direct membership or a
   *   team mandate, and for a direct membership its role.
   */
  static async getPersonAccess(
    _input: unknown,
    ctx: QuartalPluginContext,
  ): Promise<{ personId: string | null; companies: Access[] }> {
    throw notImplemented("Directory.getPersonAccess");
  }
}
