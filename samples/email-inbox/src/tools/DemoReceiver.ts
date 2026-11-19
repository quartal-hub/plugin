import type { QuartalPluginContext } from "@quartal/plugin-core";
import { getPluginCache } from "@quartal/plugin";

import type { EmailReceived } from "./model/index.ts";

/** How many received emails the demo keeps per user. */
const KEEP = 20;

/**
 * A receiver to route email to while trying the inbox, in place of a real plugin such as an
 * invoices plugin: add a route to this plugin's own URL with tool `receiveEmail`.
 */
export class DemoReceiver {
  /**
   * Receives an email from an inbox. Duplicate deliveries (same event id) are acknowledged and
   * ignored, as every receiver should.
   * @param input The email event.
   * @returns Whether it was new.
   * @visibility app
   * @accepts com.quartal.email.received
   */
  static async receiveEmail(input: EmailReceived, ctx: QuartalPluginContext): Promise<{ accepted: boolean; duplicate: boolean }> {
    const key = ["email-inbox-demo", ctx.uid ?? "anonymous", "received"];
    const received = (await getPluginCache().get<EmailReceived[]>(key)) ?? [];
    if (received.some((e) => e.id === input.id)) return { accepted: true, duplicate: true };
    await getPluginCache().set(key, [input, ...received].slice(0, KEEP));
    return { accepted: true, duplicate: false };
  }

  /**
   * The emails the demo receiver has received for you, newest first.
   * @param input No parameters.
   * @returns The emails.
   * @readOnly
   */
  static async listReceived(_input: {}, ctx: QuartalPluginContext): Promise<{ emails: EmailReceived[] }> {
    return { emails: (await getPluginCache().get<EmailReceived[]>(["email-inbox-demo", ctx.uid ?? "anonymous", "received"])) ?? [] };
  }
}
