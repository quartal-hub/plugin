import type { HubSecret, HubSecretInfo } from "../model/index.ts";
import type { HubApiClient } from "./HubApiClient.ts";

/**
 * The current user's own secrets for integrations — passwords, API keys, certificates — from the
 * Quartal IAM API. A secret belongs to the user who stored it; no call reaches another user's
 * secrets. A secret is addressed by its name, which is unique per user.
 * @experimental Part of the experimental Quartal Hub services; the API may change.
 */
export class HubSecrets {
  /** @param iam Client for the Quartal IAM API, authenticated as the current user. */
  constructor(private readonly iam: HubApiClient) {}

  /**
   * The current user's secrets: names, kinds and metadata, never the values.
   * @returns The secrets without their values.
   */
  async list(): Promise<HubSecretInfo[]> {
    const res = await this.iam.get<{ secrets: HubSecretInfo[] }>("/api/secrets");
    return res.secrets;
  }

  /**
   * One of the current user's secrets, including its value.
   * @param name The secret's name.
   * @returns The secret, or `null` when the user has none by that name.
   * @example
   * ```ts
   * const hub = getExperimentalHubContext(ctx);
   * const apiKey = (await hub.secrets.get("acme-api-key"))?.value;
   * ```
   */
  async get(name: string): Promise<HubSecret | null> {
    const res = await this.iam.get<{ secret: HubSecret | null }>(this.path(name));
    return res.secret;
  }

  /**
   * Stores a secret for the current user, replacing any secret of the same name.
   * @param name The secret's name: 1–100 characters of a-z, 0-9, `.`, `_` or `-`.
   * @param secret The secret to store.
   * @returns The stored secret without its value.
   */
  put(name: string, secret: {
    /** Free-form kind of the secret, e.g. `password`, `api-key` or `certificate`. */
    kind: string;
    /** The secret value. */
    value: string;
    /** Non-secret details to show alongside the secret, e.g. an account id or an expiry date. */
    metadata?: Record<string, unknown>;
  }): Promise<HubSecretInfo> {
    return this.iam.request<HubSecretInfo>("PUT", this.path(name), { body: secret });
  }

  /**
   * Deletes one of the current user's secrets.
   * @param name The secret's name.
   * @returns Whether a secret of that name existed and was deleted.
   */
  async delete(name: string): Promise<boolean> {
    const res = await this.iam.request<{ removed: boolean }>("DELETE", this.path(name));
    return res.removed;
  }

  private path(name: string): string {
    return `/api/secrets/${encodeURIComponent(name)}`;
  }
}
