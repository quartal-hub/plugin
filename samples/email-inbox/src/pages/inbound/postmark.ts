import type { APIRoute } from "astro";

import { InboxStore } from "../../inbox/InboxStore.ts";
import { parsePostmarkInbound } from "../../inbox/parsePostmarkInbound.ts";

/** Total attachment size accepted per email (base64 characters ≈ 4/3 of the bytes). */
const MAX_ATTACHMENT_BASE64 = 14_000_000;

/**
 * Postmark inbound webhook. Configure the webhook URL with HTTP Basic credentials whose password
 * is `INBOX_WEBHOOK_SECRET`, e.g. `https://inbox:<secret>@<plugin>/inbound/postmark`.
 *
 * The email is held for its company until delivery (`Inbox.deliverPending`): without a signed-in
 * user there is no token to call Hub Files or the receivers with yet (see `docs/events.md` §5).
 */
export const POST: APIRoute = async ({ request }) => {
  const secret = process.env.INBOX_WEBHOOK_SECRET;
  if (!secret) return new Response("INBOX_WEBHOOK_SECRET is not set", { status: 503 });
  if (!hasBasicPassword(request.headers.get("authorization"), secret)) {
    return new Response("Unauthorized", { status: 401, headers: { "www-authenticate": 'Basic realm="inbox"' } });
  }

  const email = parsePostmarkInbound(await request.json());
  const size = email.attachments.reduce((sum, a) => sum + a.contentBase64.length, 0);
  if (size > MAX_ATTACHMENT_BASE64) return new Response("Attachments too large", { status: 413 });

  let accepted = 0;
  for (const mailboxId of new Set(email.mailboxIds)) {
    const companyId = await InboxStore.getCompanyOfMailbox(mailboxId);
    if (!companyId) continue;
    await InboxStore.addMessage({
      id: crypto.randomUUID(),
      companyId,
      from: email.from,
      to: email.to,
      subject: email.subject,
      ...(email.text ? { text: email.text } : {}),
      attachments: email.attachments,
      receivedAt: new Date().toISOString(),
      status: "pending",
      deliveries: [],
    });
    accepted++;
  }
  // 200 even for unknown mailboxes: a non-2xx makes the provider retry, which won't help.
  return Response.json({ accepted });
};

function hasBasicPassword(header: string | null, secret: string): boolean {
  if (!header?.startsWith("Basic ")) return false;
  const decoded = atob(header.slice("Basic ".length));
  return decoded.slice(decoded.indexOf(":") + 1) === secret;
}
