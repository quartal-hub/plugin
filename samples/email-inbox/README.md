# Email Inbox

A sketch of an **ingress plugin** from the events design ([docs/events.md](../../docs/events.md)).
It gives a Quartal Hub company an email address, holds what arrives, and delivers each email as a
**tool call** to the plugins the company's routes name. The receiving plugin needs nothing new:
just a tool whose input is `EmailReceived`.

```
mail provider ──POST /inbound/postmark──► held in the inbox (pending)
                                               │ Inbox.deliverPending / sendTestEmail (as the user)
                                               ▼
                       attachments → company's Hub Files (/data/inbox/<date>/<id>/)
                       EmailReceived → MCP tools/call on every matching route
```

Signs users in through Quartal Hub (`auth: "quartal-hub"`) and uses the experimental Hub context.

## Tools

| Tool | What it does |
|---|---|
| `selectCompany` | Selects the company whose inbox the tools work on; lists the choices without an id |
| `getAddress` | The company's inbox address |
| `listMessages` | The emails in the inbox and where each was delivered |
| `deliverPending` | Delivers waiting emails; failed routes are retried, delivered ones are not |
| `sendTestEmail` | Puts a test email in the inbox and delivers it at once |
| `listRoutes` / `addRoute` / `removeRoute` | Where email goes: a plugin URL + tool name, optionally filtered by sender and subject |
| `findReceivers` | The tools on a plugin that take an `EmailReceived` input (read from its `/mcp/tools.json`) |
| `receiveEmail` | A demo receiver (`@visibility app`, `@accepts com.quartal.email.received`) to route to while trying it out |
| `listReceived` | What the demo receiver has received |

## Try it

```sh
cd samples/email-inbox
pnpm dev
```

Then, through an MCP client (e.g. [MCPJam](https://www.mcpjam.com/)) at `http://localhost:4321/mcp`:

1. `selectCompany`, then `addRoute` with `pluginUrl: http://localhost:4321` and `tool: receiveEmail`.
2. `sendTestEmail` with an attachment: it is saved in the company's `/data/inbox/` and delivered.
3. `listReceived` shows the event as the receiver got it.

### Real email

Point an inbound-mail provider at `POST /inbound/postmark` (Postmark's inbound JSON; another
provider needs only another parser like `src/inbox/parsePostmarkInbound.ts`).

| Env var | Meaning |
|---|---|
| `INBOX_WEBHOOK_SECRET` | Password of the webhook's HTTP Basic credentials (`https://inbox:<secret>@<host>/inbound/postmark`); the route answers 503 without it |
| `INBOX_DOMAIN` | Domain of the inbox addresses (default `inbox.example.com`) |
| `INBOX_SOURCE` | `source` of the events (default `urn:quartal:email-inbox`) |

Addresses are `<mailbox id>[+anything]@<INBOX_DOMAIN>`.

## What the sketch leaves out

- **No delivery without a person.** Calling Hub Files and the receivers needs a token, and a
  webhook has no signed-in user, so arriving email waits until someone (or an agent) runs
  `deliverPending`, and it is delivered with *their* token. Installation-scoped Hub tokens
  (docs/events.md §5) would let the webhook deliver at once.
- **State is in the plugin cache**: in memory by default, so it is lost on restart. A deployment
  injects a durable cache with `setPluginCache()`.
- **`@accepts` is not published yet.** `findReceivers` matches on input fields and `@visibility app`.
- No routing to agents, no retry backoff, attachments are capped at about 10 MB per email.
