import type { InboxMessage } from "../tools/model/index.ts";

/** An attachment as received, before it is stored in Hub Files. */
export interface IncomingAttachment {
  name: string;
  mimeType: string;
  /** The bytes, base64-encoded. */
  contentBase64: string;
}

/** An email held by the inbox until it is delivered. */
export interface StoredEmail extends Omit<InboxMessage, "attachmentCount"> {
  companyId: string;
  to: string[];
  text?: string;
  /** Kept until delivery has stored them in Hub Files, then dropped. */
  attachments: IncomingAttachment[];
  /** The Hub Files paths, once stored. */
  storedAttachments?: { path: string; name: string; mimeType: string; size: number }[];
}
