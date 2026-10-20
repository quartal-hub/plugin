import type { SecretInfo } from "./SecretInfo.ts";

/** A secret with its value. */
export interface Secret extends SecretInfo {
  value: string;
}
