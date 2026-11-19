import type { EmailAttachment } from "./EmailAttachment.ts";
import type { QrtlEventEnvelope } from "./QrtlEventEnvelope.ts";

/** The event type of {@link EmailReceived}. */
export const EMAIL_RECEIVED = "com.quartal.email.received";

/**
 * An email received for a company: the input of every tool that accepts
 * `com.quartal.email.received`. Proposed for `@quartal/plugin-core`; see `docs/events.md`.
 */
export interface EmailReceived extends QrtlEventEnvelope {
  /** The sender's address. */
  from: string;
  /** The recipients' addresses. */
  to: string[];
  subject: string;
  /** The plain-text body, when the email has one. */
  text?: string;
  /** Attachments stored in the company's Hub Files, by path. */
  attachments: EmailAttachment[];
}
