import type { IncomingAttachment } from "./StoredEmail.ts";

/** The parts of an email the inbox keeps, independent of the mail provider. */
export interface IncomingEmail {
  /** The local part of the address it was sent to: the company's mailbox id. */
  mailboxIds: string[];
  from: string;
  to: string[];
  subject: string;
  text?: string;
  attachments: IncomingAttachment[];
}

/** The fields of a Postmark inbound webhook this sample reads. */
interface PostmarkInbound {
  FromFull?: { Email?: string };
  From?: string;
  ToFull?: { Email?: string }[];
  Subject?: string;
  TextBody?: string;
  Attachments?: { Name?: string; Content?: string; ContentType?: string }[];
}

/**
 * Maps a Postmark inbound webhook body to an {@link IncomingEmail}. Another provider
 * (Mailgun, SendGrid, Amazon SES) needs only another parser like this one.
 * @param body The webhook's JSON body.
 * @returns The email.
 */
export function parsePostmarkInbound(body: unknown): IncomingEmail {
  const p = (body ?? {}) as PostmarkInbound;
  const to = (p.ToFull ?? []).map((t) => t.Email ?? "").filter(Boolean);
  return {
    mailboxIds: to.map((address) => address.split("@")[0]!.split("+")[0]!.toLowerCase()),
    from: p.FromFull?.Email ?? p.From ?? "",
    to,
    subject: p.Subject ?? "",
    ...(p.TextBody ? { text: p.TextBody } : {}),
    attachments: (p.Attachments ?? []).map((a) => ({
      name: a.Name ?? "attachment",
      mimeType: a.ContentType ?? "application/octet-stream",
      contentBase64: a.Content ?? "",
    })),
  };
}
