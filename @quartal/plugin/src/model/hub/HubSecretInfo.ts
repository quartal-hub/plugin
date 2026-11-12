/**
 * One of the current user's secrets without its value, as listed by `HubSecrets.list()`.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubSecretInfo {
  /** The secret's name: its id, unique per user, e.g. `salaxy-sso-certificate`. */
  name: string;
  /** Free-form kind of the secret, e.g. `password`, `api-key` or `certificate`. */
  kind: string;
  /** Non-secret details shown alongside the secret, e.g. an account id or an expiry date. */
  metadata: Record<string, unknown>;
  /** When the secret was first stored (ISO 8601). */
  createdAt: string;
  /** When the secret was last stored (ISO 8601). */
  updatedAt: string;
}
