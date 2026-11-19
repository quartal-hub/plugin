# Design: how plugins receive events

> **Status: PROPOSAL.** Nothing here is implemented. The Hub-side parts (installation tokens,
> Hub event delivery, agent runner) are requirements for the Quartal Hub project.

## Why

A Quartal Plugin acts only when it is called: a tool runs when an agent, a REST client or a widget
calls it. The only event-like parts today are widget events toward the embedding page
(`docs/embedded-widgets.md`) and the Hub Files change feed, which has to be *polled*
(`HubFiles.listChanges()`, `@quartal/plugin/src/hub/HubFiles.ts`).

Business plugins also need to react to things that happen elsewhere:

- **External webhooks**: an accounting, payroll or CRM system reports `invoice.created`.
- **Incoming email**: a supplier mails an invoice to `invoices@<company>…`.
- **Quartal Hub events**: a file changed in a company's drive, a member joined, the plugin was installed.
- **Schedules**: run the weekly report every Monday at 06:00.

Sometimes the right reaction is a fixed function. Sometimes it is to **start an agent** that
decides what to do.

## Decision: an event is a tool call

Events are delivered as **ordinary tool calls**. All channel-specific work (mailboxes, webhook
signatures, cron, retries, routing) lives in reusable **ingress plugins**, which are ordinary
Quartal Plugins too. A plugin that wants to receive events needs no new primitive. It exposes a
tool and says which event types the tool accepts.

```
email    ──► Email Inbox plugin ──┐
webhook  ──► Webhooks plugin    ──┼──(tool call, installation token)──► Invoices plugin
schedule ──► Scheduler plugin   ──┤                                     Invoices.importFromEmail(…)
Hub      ──► Quartal Hub        ──┘
                     │
                     └──(route to agent)──► agent run ──► calls any plugin's tools
```

Benefits:

- **Little framework change.** Receivers use the tool machinery that already exists: codegen,
  JSON Schema validation, REST and MCP, docs SPA, tests.
- **Channels are written once.** Mail parsing and webhook signature checks are not repeated in
  every plugin.
- **Composition.** One event can go to any plugin, to several plugins, or to an agent, and routes
  are configured per company without redeploying the receiver.

## 1. Receiving: tools tagged with `@accepts`

```ts
// src/tools/Invoices.ts
export class Invoices {
  /**
   * Imports the invoices attached to an email.
   * @param input The received email; attachments are already stored in Hub Files.
   * @returns What was imported and what was skipped.
   * @visibility app
   * @accepts com.quartal.email.received
   */
  static async importFromEmail(input: EmailReceived, ctx: QuartalPluginContext): Promise<ImportResult> {
    // …
  }
}
```

- `@visibility app` (existing tag) keeps the tool off the model's tool list. Event receivers are
  usually not something a model should call.
- `@accepts <event-type>[, <event-type>…]` (new tag) is read by the codegen plugin
  (`@quartal/plugin/src/vite/qrtlCodegenPlugin.ts`) the same way as `@visibility`. It is
  published on the tool (`tools.json`, MCP `_meta`) and summarized in the manifest
  (`/plugin.json`, `/com.quartal.plugin/contents.json`), so ingress plugins and the Hub can find
  receivers without calling them.
- The tool's input type is the contract. Codegen checks that a tool which accepts a *known* event
  type takes that type's payload (warning on mismatch).

### Shared event types

Common payload types live in the `@quartal/plugin-core` model, so sender and receiver compile
against the same definition. Every payload carries a CloudEvents-style envelope:

```ts
interface QrtlEventEnvelope {
  /** Unique per event; the same on redelivery. Use it to deduplicate. */
  id: string;
  /** Reverse-DNS event type, e.g. `com.quartal.email.received`. */
  type: string;
  /** Who produced it, e.g. the ingress plugin's URL or `https://hub.quartal.com`. */
  source: string;
  /** When it happened (ISO 8601). */
  time: string;
}

interface EmailReceived extends QrtlEventEnvelope {
  from: string;
  to: string[];
  subject: string;
  text?: string;
  /** Attachments stored in the company's Hub Files, by path. */
  attachments: { path: string; name: string; mimeType: string; size: number }[];
}
```

The first set: `EmailReceived`, `WebhookReceived` (generic: headers + parsed body),
`ScheduleTick`, `FilesChanged`, `PluginInstalled`. A plugin can define its own types under its own
reverse-DNS prefix.

### Delivery semantics

- **At least once.** The same event can arrive twice, so receivers deduplicate on `id`.
  `PluginCache` (`@quartal/plugin/src/cache/PluginCache.ts`) works for this when it has a durable
  backend. The default `MemoryCache` is per-process.
- **No ordering guarantee** across events. A receiver that needs order uses a cursor (like the
  Files change feed) instead of trusting arrival order.
- A tool error (non-2xx) means "retry". A receiver that wants to drop an event returns normally
  and reports it in its result.

## 2. Ingress plugins

An ingress plugin owns one channel. It turns what arrives into an event and calls the routed
tools. Proposed first set:

| Plugin | Accepts from the outside | Notes |
|---|---|---|
| **Email Inbox** | Mail to per-company addresses (via an inbound-mail provider) | Stores attachments in Hub Files and passes paths, not bytes. Handles spam and size limits. |
| **Webhooks** | `POST` to per-company, per-source URLs | Verifies signatures (Standard Webhooks HMAC by default, provider presets), secrets in Hub secrets (`HubSecrets`). Maps provider payloads to event types. |
| **Scheduler** | Cron expressions | Emits `ScheduleTick`. Plugins don't need per-target cron wiring (Vercel crons, Cloudflare `scheduled`, Node timers). |

Each ingress plugin owns:

- **Routing table**, per company: *event filter → plugin + tool* or *event filter → agent*. A
  filter matches on `type` and on payload fields (e.g. `to`, a path prefix). Routes are managed
  through the ingress plugin's own tools and widgets, so a user can set them up by talking to an
  agent ("send mail to invoices@ to the Invoices plugin").
- **Discovery**: when creating a route, it reads the target's manifest and suggests the tools
  whose `@accepts` matches.
- **Retries** with backoff, **dedupe** of inbound duplicates, and a **dead-letter** list with
  replay.
- **Calling the receiver.** `PluginClient` (`@quartal/plugin-core/src/client/PluginClient.ts`)
  only reads metadata today. It gains a bearer token option and `callTool(name, input)` over REST
  `POST /api/<Class>/<method>`.

Anyone can write an ingress plugin. Quartal provides the three above.

A runnable sketch of the Email Inbox is in [`samples/email-inbox`](../samples/email-inbox/).

### Worked example: supplier invoice by email

1. The company routes `com.quartal.email.received` with `to = invoices@acme.<domain>` →
   Invoices plugin, `importFromEmail`.
2. A supplier sends a PDF. Email Inbox stores it in `/data/inbox/2026-11-19/invoice-123.pdf` and
   builds an `EmailReceived`.
3. Email Inbox gets an installation token for Acme's installation of the Invoices plugin (§5) and
   calls `POST /api/Invoices/importFromEmail`.
4. Invoices reads the PDF through `getExperimentalHubContext(ctx).files`, books it, and returns
   `ImportResult`. A failure is retried, and after the last attempt the event is dead-lettered.

## 3. Routing to an agent

A route can target an **agent** instead of a tool. This suits unstructured input like email,
where no single tool signature fits. The agent reads the event and decides which tools to call.

- The route names an agent from any installed plugin (`agents/*.md`, see `docs/agents.md`). The
  event is rendered into the first user turn, using the agent's `initialPrompt` as a template if it
  has one.
- An agent can also ask for events declaratively in its frontmatter. Ingress plugins and the Hub
  offer these as suggested routes when the plugin is installed:

  ```yaml
  triggers:
    - event: com.quartal.email.received
      filter: { to: "invoices@*" }
  ```

- **The plugin does not run the agent.** A pluggable *agent runner* does: Quartal Hub (the
  target, running as the installation, §5) or a configured runner such as Claude Managed Agents for
  self-hosted setups. The run's outcome comes back as an event (`com.quartal.agent.run.completed`)
  that can be routed like any other.

## 4. Quartal Hub events

The Hub is just another sender. When a plugin is installed for a company, the Hub reads the
manifest. For every tool whose `@accepts` lists a Hub event type, it offers or creates a route and
calls the tool when the event happens:

- `com.quartal.hub.files.changed`: payload carries the change page from the Files change feed,
  filterable by drive and path prefix.
- `com.quartal.hub.company.member.added` / `…removed`
- `com.quartal.hub.plugin.installed` / `…uninstalled`: setup and cleanup for the installation.

**Until the Hub pushes**, the Scheduler plugin can call a small poller tool that reads
`listChanges({ since })` with the cursor in `PluginCache` and calls the same receiver. Receivers
don't change when push delivery arrives.

## 5. Identity: the key open problem

No user is signed in when an event arrives, so `QuartalPluginContext.token`
(`@quartal/plugin-core/src/model/context/QuartalPluginContext.ts`) is empty and
`getExperimentalHubContext(ctx)` can't call Hub services. Every option above depends on solving
this.

Proposal:

- The Hub issues **installation-scoped tokens**: the subject is a plugin installation (plugin +
  company), not a user. Sender plugins obtain them client-credentials style, for the receiver's
  installation in the same company only.
- The receiver verifies them like user tokens (same issuer, JWKS) and gets a context with an
  `installation` (`companyId`, installation id) instead of `uid`/`email`.
  `getExperimentalHubContext` uses the installation's company as the default files owner.
- The Hub records which sender may call which receiver (granted by creating the route), so a
  token for one installation can't reach another company's data.

Hub-side requirements: an installation registry, installation tokens, per-route grants, and an
audit trail of event deliveries.

## 6. Considered: event handlers inside each plugin

The alternative is a new primitive: `src/events/` handler classes, `/events/<source>` webhook
routes, and cron wiring per hosting target (`vercel.json` crons, Cloudflare `triggers.crons` plus
a `scheduled()` export, an in-process scheduler on Node). It is not the primary model because:

- every plugin would reimplement signatures, retries, dedupe and mail parsing;
- the framework and every deploy target (`deployment/targets/`) would grow substantially;
- routing would be fixed at build time instead of configured per company.

A thin helper may still make sense later for a plugin that has to receive one provider's webhook
directly, with no ingress plugin in between. That would be a framework route which verifies a
signature and calls the plugin's own `@accepts` tool, keeping the same receiver contract.

## 7. Out of scope and open questions

Out of scope: pushing events to live MCP sessions (resource subscriptions and notifications),
widget live updates, ordered delivery.

Open questions:

- Event-type naming: reverse-DNS `com.quartal.*` for everything, or short names for well-known types?
- Who owns retry policy when the Hub delivers: the Hub, or an ingress plugin in front of it?
- Fan-out: may one event go to several routes, and is each delivery retried independently?
- Latency and cost of the extra hop for high-volume webhooks.
- Whether `@accepts` tools should be callable only with installation tokens, never by users.
