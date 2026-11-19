import type { DeliveryResult } from "./DeliveryResult.ts";

/** An email in the inbox and where it has been delivered. */
export interface InboxMessage {
  id: string;
  from: string;
  subject: string;
  /** When it arrived (ISO 8601). */
  receivedAt: string;
  /** `pending` until delivered; `failed` when a route failed (deliver again to retry). */
  status: "pending" | "delivered" | "failed" | "unrouted";
  attachmentCount: number;
  deliveries: DeliveryResult[];
}
