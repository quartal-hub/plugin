import type { QuartalPluginContext } from "@quartal/plugin-core";
import { notImplemented } from "./notImplemented.ts";

/** The identity verification state of a user. */
export interface KycStatus {
  /** `not_verified`, `pending` or `verified`. */
  status: string;
}

/**
 * Identity verification (KYC) of the calling user. The status can only be read and verification
 * requested here; it is changed by the verification process, never by the user.
 */
export class Kyc {
  /**
   * The calling user's identity verification status.
   * @summary /api/Kyc/getStatus
   * @mcp hidden
   * @param _input No parameters.
   * @returns The status.
   */
  static async getStatus(_input: unknown, ctx: QuartalPluginContext): Promise<KycStatus> {
    throw notImplemented("Kyc.getStatus");
  }

  /**
   * Requests identity verification for the calling user: the status becomes `pending` until the
   * verification completes. A user who is already verified stays verified.
   * @summary /api/Kyc/start
   * @mcp hidden
   * @param _input No parameters.
   * @returns The status after the request.
   */
  static async start(_input: unknown, ctx: QuartalPluginContext): Promise<KycStatus> {
    throw notImplemented("Kyc.start");
  }
}
