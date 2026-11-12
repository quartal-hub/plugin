import type { QuartalPluginContext } from "@quartal/plugin-core";
import type { Secret } from "./model/Secret.ts";
import type { SecretInfo } from "./model/SecretInfo.ts";
import { notImplemented } from "./notImplemented.ts";

/**
 * The calling user's own secrets for integrations: passwords, API keys, certificates. A secret
 * belongs to the user it was stored by; no call can reach another user's secrets. A secret is
 * addressed by its name, which is its id: unique per user.
 * @mcp hidden
 */
export class Secrets {
  /**
   * The caller's secrets: names, kinds and metadata, never the values.
   * @summary /api/Secrets/list
   * @param _input No parameters.
   * @returns The caller's secrets without their values.
   */
  static async list(_input: unknown, ctx: QuartalPluginContext): Promise<{ secrets: SecretInfo[] }> {
    throw notImplemented("Secrets.list");
  }

  /**
   * One of the caller's secrets, including its value.
   * @summary /api/Secrets/get
   * @param input The secret to read.
   * @returns The secret, or `null` when the caller has none by that name.
   */
  static async get(
    input: {
      /** The secret's name (unique per user). */
      id: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ secret: Secret | null }> {
    throw notImplemented("Secrets.get");
  }

  /**
   * Stores a secret for the caller, replacing any secret of the same name.
   * @summary /api/Secrets/set
   * @param input The secret to store.
   * @returns The stored secret without its value.
   */
  static async put(
    input: {
      /** The secret's name, unique per user: 1–100 characters of a-z, 0-9, '.', '_' or '-'. */
      id: string;
      /** Free-form kind of the secret, e.g. `password`, `api-key` or `certificate`. */
      kind: string;
      /** The secret value. */
      value: string;
      /** Non-secret details to show alongside the secret, e.g. an account id or an expiry date. */
      metadata?: { [key: string]: unknown };
    },
    ctx: QuartalPluginContext,
  ): Promise<SecretInfo> {
    throw notImplemented("Secrets.put");
  }

  /**
   * Deletes one of the caller's secrets.
   * @summary /api/Secrets/remove
   * @param input The secret to delete.
   * @returns Whether a secret of that name existed and was deleted.
   */
  static async delete(
    input: {
      /** The secret's name. */
      id: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ removed: boolean }> {
    throw notImplemented("Secrets.delete");
  }
}
