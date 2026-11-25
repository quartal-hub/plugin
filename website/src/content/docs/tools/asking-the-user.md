---
title: "Asking the user"
description: "Pause a tool call to ask the user for a confirmation, a choice or a sign-in — MCP elicitation from plain TypeScript."
section: creating
order: 1.5
---

A tool can stop in the middle of a call and **ask the user** — confirm a payment, pick an account,
sign in to a bank — and then continue with the answer. This is MCP
[elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation): the
client (Claude, Claude Code, or any client that supports it) shows a form or opens a page, and
the answer goes straight to your tool, not through the agent.

```ts
// file: src/tools/Payments.ts
import type { QuartalPluginContext } from "@quartal/plugin-core";
import { elicitForm } from "@quartal/plugin/elicit";

/** Shown to the user before an invoice is paid. */
export interface PaymentConfirmation {
  /** Account to pay from. */
  account: "operating" | "savings";
  /** I have checked the amount. */
  confirmed: boolean;
  /** A note for the bookkeeping. @maxLength 200 */
  note?: string;
}

export class Payments {
  /**
   * Pays an invoice after the user confirms it.
   * @param input The invoice to pay.
   */
  async payInvoice(input: { invoiceId: string }, ctx: QuartalPluginContext) {
    const invoice = await loadInvoice(input.invoiceId);
    const answer = await elicitForm<PaymentConfirmation>(ctx, "confirm", {
      message: `Pay ${invoice.total} € to ${invoice.payee}?`,
    });
    if (answer.action !== "accept" || !answer.content.confirmed) {
      return { status: "not paid" };
    }
    return pay(invoice, answer.content.account);
  }
}
```

## The form comes from the type

The type argument of `elicitForm<T>` *is* the form. The code generator turns it into the form's
JSON Schema, so there is nothing else to write:

- each property is one field; its JSDoc is the field label (with `@summary` the summary is the
  label and the JSDoc text the help text);
- `string` (add `@format email`, `uri`, `date` or `date-time`), `number` and `boolean` fields;
- a string-literal union (`"operating" | "savings"`) is a single choice, an array of one is a
  multiple choice;
- `?` makes a field optional; `@default`, `@minimum`, `@maximum`, `@minLength`, `@maxLength`,
  `@minItems` and `@maxItems` are copied.

Forms are flat: a nested object or any other array type fails the build with the offending field
named. The key (`"confirm"`) must be a string literal; to build the form at runtime instead, pass
`options.schema`.

**Never ask for passwords, API keys or payment details in a form.** Use `elicitUrl` for those.

## How the call works: ask first, act after

Asking is stateless. When the answer is not in the request yet, `elicitForm` stops the call, the
client shows the form, and then **calls the tool again** with the answer. Your method runs again
from the start and this time `elicitForm` returns the answer.

So everything before `elicitForm` runs once per attempt: read and check things first, ask, and
change things only after the answer. A tool can ask several questions; each one adds a round.

The answer is one of:

| `action` | Meaning |
|---|---|
| `"accept"` | The user filled in the form; `content` has the values, already checked against the form. |
| `"decline"` | The user said no. |
| `"cancel"` | The user closed the form without choosing. |

## Opening a page: `elicitUrl`

For anything that must not pass through the agent — signing in to another service, entering a
secret, paying — send the user to a page:

```ts
import { elicitUrl } from "@quartal/plugin/elicit";

const answer = await elicitUrl(ctx, "bank-login", {
  message: "Sign in to your bank to connect the account.",
  url: "https://bank-connect.example.com/start",
});
```

`accept` only means that the user agreed to open the page. Check the outcome yourself (for example,
whether the connection now exists) and ask again with a new key if it does not. The URL must not
contain personal data or credentials, and the page must check that the person who opens it is the
user of this tool call.

## When the caller cannot ask

Older MCP clients (protocol 2025 and earlier) and clients that do not support elicitation cannot
show the form. Then `elicitForm` and `elicitUrl` return `{ action: "decline" }` without asking, so
the tool takes its "not confirmed" path. Pass `fallback: "error"` to fail the call with the
message instead:

```ts
await elicitForm<PaymentConfirmation>(ctx, "confirm", { message: "Confirm the payment first.", fallback: "error" });
```

## Over REST

A REST caller opts in with the `Qrtl-Elicitation: form` (or `form, url`) header. The first call
then answers **HTTP 428** with the questions:

```json
{ "resultType": "input_required",
  "inputRequests": { "confirm": { "method": "elicitation/create",
    "params": { "mode": "form", "message": "Pay 1240 € to Acme Oy?", "requestedSchema": { … } } } } }
```

The caller shows the form and sends the **same request again** with the answers in the
`Qrtl-Input-Responses` header, as base64url-encoded JSON:

```json
{ "confirm": { "action": "accept", "content": { "account": "operating", "confirmed": true } } }
```

Without the `Qrtl-Elicitation` header, the tool gets the fallback, just like an MCP client that
cannot ask. Tools that ask document the 428 response in `open-api.json`.
