import { getPluginCache } from "@quartal/plugin";

import type { InboxRoute } from "../tools/model/index.ts";
import type { StoredEmail } from "./StoredEmail.ts";

/** How many emails a company's inbox keeps. */
const MAX_MESSAGES = 50;

const PREFIX = "email-inbox";

/**
 * The inbox's state in the plugin cache: mailbox ids, routes and held emails per company.
 * With the default in-memory cache everything is lost on restart; a real deployment injects a
 * durable cache with `setPluginCache()`.
 */
export class InboxStore {
  /** The company a mailbox id belongs to. */
  static async getCompanyOfMailbox(mailboxId: string): Promise<string | undefined> {
    return getPluginCache().get<string>([PREFIX, "mailbox", mailboxId]);
  }

  /** The company's mailbox id, created on first use. */
  static async getOrCreateMailbox(companyId: string): Promise<string> {
    const cache = getPluginCache();
    const existing = await cache.get<string>([PREFIX, "company", companyId, "mailbox"]);
    if (existing) return existing;
    const mailboxId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    await cache.set([PREFIX, "mailbox", mailboxId], companyId);
    await cache.set([PREFIX, "company", companyId, "mailbox"], mailboxId);
    return mailboxId;
  }

  static async getRoutes(companyId: string): Promise<InboxRoute[]> {
    return (await getPluginCache().get<InboxRoute[]>([PREFIX, "company", companyId, "routes"])) ?? [];
  }

  static async setRoutes(companyId: string, routes: InboxRoute[]): Promise<void> {
    await getPluginCache().set([PREFIX, "company", companyId, "routes"], routes);
  }

  static async getMessages(companyId: string): Promise<StoredEmail[]> {
    return (await getPluginCache().get<StoredEmail[]>([PREFIX, "company", companyId, "messages"])) ?? [];
  }

  /** Adds an email, newest first, dropping the oldest beyond {@link MAX_MESSAGES}. */
  static async addMessage(email: StoredEmail): Promise<void> {
    const messages = await InboxStore.getMessages(email.companyId);
    await InboxStore.saveMessages(email.companyId, [email, ...messages].slice(0, MAX_MESSAGES));
  }

  /** Replaces one email by id. */
  static async updateMessage(email: StoredEmail): Promise<void> {
    const messages = await InboxStore.getMessages(email.companyId);
    await InboxStore.saveMessages(email.companyId, messages.map((m) => (m.id === email.id ? email : m)));
  }

  private static async saveMessages(companyId: string, messages: StoredEmail[]): Promise<void> {
    await getPluginCache().set([PREFIX, "company", companyId, "messages"], messages);
  }
}
