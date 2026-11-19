import type { QuartalPluginContext } from "@quartal/plugin-core";
import { getExperimentalHubContext } from "@quartal/plugin/hub";

import { type DeliveryResult, EMAIL_RECEIVED, type EmailReceived, type InboxRoute } from "../tools/model/index.ts";
import { callPluginTool } from "./callPluginTool.ts";
import { InboxStore } from "./InboxStore.ts";
import type { StoredEmail } from "./StoredEmail.ts";

/** `source` of the events this inbox produces. */
const SOURCE = process.env.INBOX_SOURCE ?? "urn:quartal:email-inbox";

/**
 * Delivers one email: stores its attachments in the company's Hub Files, then calls every
 * matching route's tool with an {@link EmailReceived} event. Routes that already succeeded are
 * not called again, so delivering a failed email retries only the failed routes.
 *
 * Runs as the signed-in user (`ctx.token`): until the Hub issues installation tokens, a person or
 * agent has to trigger delivery. See `docs/events.md` §5.
 * @param ctx The calling tool's context.
 * @param email The email.
 * @returns The email after delivery.
 */
export async function deliverEmail(ctx: QuartalPluginContext, email: StoredEmail): Promise<StoredEmail> {
  const hub = getExperimentalHubContext(ctx);
  const owner = email.companyId;

  if (!email.storedAttachments) {
    const folder = `/data/inbox/${email.receivedAt.slice(0, 10)}/${email.id}`;
    email.storedAttachments = [];
    for (const a of email.attachments) {
      const bytes = Uint8Array.from(atob(a.contentBase64), (c) => c.charCodeAt(0));
      const path = `${folder}/${safeFileName(a.name)}`;
      await hub.files.write(path, bytes, { owner, mkdirp: true, mimeType: a.mimeType, message: `Email from ${email.from}` });
      email.storedAttachments.push({ path, name: a.name, mimeType: a.mimeType, size: bytes.length });
    }
    email.attachments = [];
  }

  const event: EmailReceived = {
    id: email.id,
    type: EMAIL_RECEIVED,
    source: SOURCE,
    time: email.receivedAt,
    from: email.from,
    to: email.to,
    subject: email.subject,
    ...(email.text ? { text: email.text } : {}),
    attachments: email.storedAttachments,
  };

  const routes = (await InboxStore.getRoutes(owner)).filter((r) => matches(r, email));
  const done = new Set(email.deliveries.filter((d) => d.ok).map((d) => d.routeId));
  const deliveries: DeliveryResult[] = email.deliveries.filter((d) => d.ok);
  for (const route of routes.filter((r) => !done.has(r.id))) {
    deliveries.push(await deliverTo(route, event, ctx.token));
  }

  email.deliveries = deliveries;
  email.status = routes.length === 0 ? "unrouted" : deliveries.every((d) => d.ok) ? "delivered" : "failed";
  await InboxStore.updateMessage(email);
  return email;
}

async function deliverTo(route: InboxRoute, event: EmailReceived, token: string | undefined): Promise<DeliveryResult> {
  const base = { routeId: route.id, pluginUrl: route.pluginUrl, tool: route.tool };
  try {
    const { ok, value } = await callPluginTool(route.pluginUrl, route.tool, event, token);
    return { ...base, ok, message: shorten(typeof value === "string" ? value : JSON.stringify(value)) };
  } catch (e) {
    return { ...base, ok: false, message: shorten(e instanceof Error ? e.message : String(e)) };
  }
}

/** Whether a route takes this email: every condition it sets matches (case-insensitive). */
function matches(route: InboxRoute, email: StoredEmail): boolean {
  const has = (value: string, part?: string) => !part || value.toLowerCase().includes(part.toLowerCase());
  return has(email.from, route.fromContains) && has(email.subject, route.subjectContains);
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").replace(/^\.+/, "").slice(0, 120) || "attachment";
}

function shorten(text: string): string {
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}
