import type { QuartalPluginContext } from "@quartal/plugin-core";
import { getExperimentalHubContext } from "@quartal/plugin/hub";

import { deliverEmail } from "../inbox/deliverEmail.ts";
import { InboxStore } from "../inbox/InboxStore.ts";
import { requireCompany } from "../inbox/requireCompany.ts";
import type { StoredEmail } from "../inbox/StoredEmail.ts";
import type { InboxMessage } from "./model/index.ts";

/** Domain of the inbox addresses; set it to the domain your mail provider receives for. */
const INBOX_DOMAIN = process.env.INBOX_DOMAIN ?? "inbox.example.com";

/**
 * A company's email inbox: an address that receives email and delivers each message, as a tool
 * call, to the plugins its routes name. Set up routes with the Routes tools.
 */
export class Inbox {
  /**
   * Selects the Hub company whose inbox the other tools work on. Called without an id, lists
   * the companies to choose from.
   * @param input The company.
   * @returns The selected company, or the choices.
   */
  static async selectCompany(
    input: {
      /** Quartal IAM id of the company; omit to list the companies. */
      companyId?: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ selected: string | null; companies: { companyId: string; name: string }[] }> {
    const hub = getExperimentalHubContext(ctx);
    if (input?.companyId) {
      const selected = await hub.companies.setSelected(input.companyId);
      return { selected: selected?.name ?? null, companies: [] };
    }
    const [companies, selected] = await Promise.all([hub.companies.list(), hub.companies.getSelected()]);
    return { selected: selected?.name ?? null, companies: companies.map((c) => ({ companyId: c.companyId, name: c.name })) };
  }

  /**
   * The selected company's inbox address. Email sent to it is held in the inbox until delivered.
   * @param input No parameters.
   * @returns The address.
   */
  static async getAddress(
    _input: {},
    ctx: QuartalPluginContext,
  ): Promise<{ company: string; address: string }> {
    const company = await requireCompany(ctx);
    const mailboxId = await InboxStore.getOrCreateMailbox(company.companyId);
    return { company: company.name, address: `${mailboxId}@${INBOX_DOMAIN}` };
  }

  /**
   * The emails in the selected company's inbox, newest first, and where each was delivered.
   * @param input Optional filter.
   * @returns The emails.
   * @readOnly
   */
  static async listMessages(
    input: {
      /** Only emails in this state. */
      status?: "pending" | "delivered" | "failed" | "unrouted";
    },
    ctx: QuartalPluginContext,
  ): Promise<{ messages: InboxMessage[] }> {
    const { companyId } = await requireCompany(ctx);
    const messages = (await InboxStore.getMessages(companyId)).filter((m) => !input?.status || m.status === input.status);
    return { messages: messages.map(toMessage) };
  }

  /**
   * Delivers the emails that are waiting (pending, or failed on some route) to their routes:
   * stores the attachments in the company's Hub Files and calls each route's tool.
   * @param input No parameters.
   * @returns The emails that were delivered or tried.
   */
  static async deliverPending(
    _input: {},
    ctx: QuartalPluginContext,
  ): Promise<{ messages: InboxMessage[] }> {
    const { companyId } = await requireCompany(ctx);
    const waiting = (await InboxStore.getMessages(companyId)).filter((m) => m.status === "pending" || m.status === "failed");
    const delivered: InboxMessage[] = [];
    for (const email of waiting) delivered.push(toMessage(await deliverEmail(ctx, email)));
    return { messages: delivered };
  }

  /**
   * Puts a test email in the selected company's inbox and delivers it at once, like one that
   * arrived through the mail provider. For trying routes without sending real email.
   * @param input The email.
   * @returns The email after delivery.
   */
  static async sendTestEmail(
    input: {
      /** Sender address. */
      from: string;
      subject: string;
      /** Plain-text body. */
      text?: string;
      /** A text attachment to include, e.g. a CSV invoice row. */
      attachment?: { name: string; text: string };
    },
    ctx: QuartalPluginContext,
  ): Promise<InboxMessage> {
    const { companyId } = await requireCompany(ctx);
    const mailboxId = await InboxStore.getOrCreateMailbox(companyId);
    const email: StoredEmail = {
      id: crypto.randomUUID(),
      companyId,
      from: input.from,
      to: [`${mailboxId}@${INBOX_DOMAIN}`],
      subject: input.subject,
      ...(input.text ? { text: input.text } : {}),
      attachments: input.attachment
        ? [{ name: input.attachment.name, mimeType: "text/plain", contentBase64: toBase64(input.attachment.text) }]
        : [],
      receivedAt: new Date().toISOString(),
      status: "pending",
      deliveries: [],
    };
    await InboxStore.addMessage(email);
    return toMessage(await deliverEmail(ctx, email));
  }
}

function toMessage(e: StoredEmail): InboxMessage {
  return {
    id: e.id,
    from: e.from,
    subject: e.subject,
    receivedAt: e.receivedAt,
    status: e.status,
    attachmentCount: e.storedAttachments?.length ?? e.attachments.length,
    deliveries: e.deliveries,
  };
}

function toBase64(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}
