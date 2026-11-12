import type { HubSecretInfo } from "./HubSecretInfo.ts";

/**
 * One of the current user's secrets including its value, as returned by `HubSecrets.get()`.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubSecret extends HubSecretInfo {
  /** The secret value. */
  value: string;
}
