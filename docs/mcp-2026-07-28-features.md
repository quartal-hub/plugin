# Plan: Skills over MCP, Tasks, Elicitation, File transfers and Resources

> **Status: PHASES 1–4 IMPLEMENTED in this repo (2026-11-25, version 2 beta), Tasks (phase 5)
> open.** Written after Anthropic's announcement (2026-11-24) that Claude and Claude Code support
> Skills over MCP (public beta), Tasks and Elicitation (GA), and File Uploads (rolling out), all on
> the stateless MCP `2026-07-28` revision. Built: skills over MCP (`/mcp/skills.json` replaces
> `/skills/catalog.json`), `@quartal/plugin/elicit`, `src/resources/` resources and templates,
> `qrtl://` references in `@quartal/plugin/hub`, and the files extension in `@quartal/plugin/files`.
> The Quartal Files plugin side (tools, resources, skill, widget, Directory listing) is in the
> Quartal Files project. Deviations from the analysis below: Quartal Files already used
> `qrtl://<owner>/<drive>/<path>` URIs, so references are `qrtl://` (not `qrtl://`) and a version
> is pinned with `?version=` (file names may contain `@`); and because the Quartal Files plugin is
> itself a Quartal plugin, the files extension (`McpFile`, `upload_required`, file staging) is
> implemented generically in the framework — only the Files plugin needs a Directory listing.

## Sources

- Anthropic announcement — <https://claude.com/resources/articles/skills-over-mcp-tasks-and-more>
- Skills extension (SEP-2640, Final) — <https://modelcontextprotocol.io/extensions/skills/overview>,
  normative spec in <https://github.com/modelcontextprotocol/ext-skills>
- Tasks extension (SEP-2663) — <https://modelcontextprotocol.io/extensions/tasks/overview>, spec in
  <https://github.com/modelcontextprotocol/ext-tasks>
- Elicitation — <https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation>, plus
  the MRTR pattern (`/specification/2026-07-28/basic/patterns/mrtr`) and the 2026-07-28 changelog
- File transfers — <https://claude.com/docs/connectors/building/files>, extension spec in
  <https://github.com/modelcontextprotocol/experimental-ext-file-uploads>

## Summary

| Feature | Wire mechanism (2026-07-28) | Claude support | SDK 2.4 support | Fit with our stack | Priority |
|---|---|---|---|---|---|
| **Skills over MCP** | `io.modelcontextprotocol/skills`: `skills/list`, `skills/get`, skill files via `resources/read` (`skill://…`) | Claude + Claude Code, public beta | ✅ `@modelcontextprotocol/server/ext/skills` (`SkillCatalog`, `memorySkillFiles`) | Trivial: we already have `skills/` + a build-time file map | **P1 — now** |
| **Elicitation** | MRTR: `tools/call` returns `resultType: "input_required"` + `inputRequests` + `requestState`; client retries | GA | ✅ `inputRequired()`, `createRequestStateCodec()` | Good, stateless; needs a re-execution model in tool code | **P1** |
| **Resources (general)** | `resources/list`, `resources/templates/list`, `resources/read`, `ttlMs`/`cacheScope` | Partial in clients (see below) | ✅ core | Required anyway by skills; Quartal Files is the obvious first source | **P1 (infrastructure) / P2 (Files)** |
| **File transfers** | `io.modelcontextprotocol/files`: `x-mcp-file` input schema, `upload_required` + signed URLs, `_meta` downloads | Rolling out; **Directory-listed connectors only** | ❌ hand-rolled | Implemented once, in the Quartal Files plugin (`HubFiles` upload/download URLs); other plugins take `qrtl://` references | **P2 — high value, gated** |
| **Tasks** | `io.modelcontextprotocol/tasks`: `resultType: "task"`, `tasks/get` / `tasks/update` / `tasks/cancel` | GA | ❌ (only the old 2025-11-25 core task types) | Hard: needs a durable store + background execution on serverless | **P3 — design now, build with Hub** |

Cross-cutting: **all of these exist only on the 2026-07-28 ("modern") path**. Our legacy stateless
fallback (2025-era clients: ChatGPT, older Inspector/MCPJam) gets none of them, so every feature
needs a defined degradation for legacy clients and for the REST/OpenAPI surface.

---

## 1. Skills over MCP

### What the extension is

- Server declares `capabilities.extensions["io.modelcontextprotocol/skills"]` (optionally
  `{ directoryRead: true }`) and the `resources` capability in `server/discover`.
- `skills/list` returns, per skill: `uri` (the `SKILL.md` URI, e.g. `skill://invoice-review/SKILL.md`),
  the full `frontmatter` verbatim, and a complete file **manifest** (`uri`, `sha256:` digest, `size`).
  Results carry `resultType`, `ttlMs`, `cacheScope`.
- Files are read through plain `resources/read`; the host verifies digest + size, binds user approval
  to the manifest and re-asks when it changes. Hosts never prefetch; progressive disclosure is the
  host's job.
- Limits: ≤ 512 files and ≤ 16 MiB per skill. Skill folder name MUST equal frontmatter `name`.

### Fit

Our `skills/<name>/SKILL.md` layout is exactly what the extension expects, and the SDK we already
depend on (2.4) ships the whole server side:

```ts
import { SkillCatalog, memorySkillFiles } from "@modelcontextprotocol/server/ext/skills";
const catalog = await SkillCatalog.load(memorySkillFiles(/* from the build-time file map */), {
  cacheHint: { ttlMs: 300_000, cacheScope: "public" },
});
catalog.attach(mcpServer);
```

`skillDiscovery.ts` / `skillsFromFileMap` already produce the file list; we feed the same map to
`memorySkillFiles` (Workers-safe, no fs) and `nodeSkillFiles` in dev.

### Required refactor

`SkillsExtension.attach()` takes the high-level **`McpServer`**, while `PluginMcpHelper` builds the
low-level `Server` and owns `resources/list` / `resources/read` itself (for widgets). Attaching the
skills extension would collide with our hand-written resource handlers. So:

1. Move `PluginMcpHelper.buildServer()` to `McpServer` and register widgets with
   `registerResource(...)` instead of raw `setRequestHandler("resources/*")`. Tools/prompts can stay
   on raw handlers via `mcpServer.server.setRequestHandler` if the high-level registration does not
   fit our generated Zod schemas.
2. Attach one `SkillCatalog` per mounted server. Open question: should `/mcp/<name>` sub-servers get
   all skills or a subset? Proposal: `mcp.servers[].skills?: string[]` mirroring `tools`, default =
   all skills on the main server only (same rule as prompts today).
3. `qrtl.config` switch `mcp.skills: false` to opt out.

### What to keep, what to drop (the compatibility question)

Rule applied: keep what an established, cross-vendor standard or a known non-Quartal client
consumes; drop what only our own docs SPA / Hub reads.

| Current surface | Consumer | Decision |
|---|---|---|
| `skills/` folder in the Agent Plugins package (`/plugin.zip`, `/plugin.json`) | Codex/ChatGPT, Copilot, Cursor, Kiro, Claude Code (via `.claude-plugin/`) | **Keep** — this is the cross-vendor install path. |
| `npx skills add <github tree url>` install commands | `skills` CLI (multi-agent) | **Keep** (docs only, no server surface). |
| `GET /skills/<name>.zip` | Manual upload into Claude apps / ChatGPT skill upload | **Keep.** |
| `GET /skills/<name>.skill` | Same bytes as `.zip` | **Drop** unless a client needs the extension — verify Claude Desktop's import before removing. |
| `GET /skills/<name>/SKILL.md`, `/skills/<name>/*` | Docs SPA, humans, links in `SKILL.md` | **Keep** (cheap, URL-addressable source of truth; same bytes as `skill://`). |
| `GET /skills/catalog.json` (`SkillsCatalogResponse`) | Our docs SPA, `PluginClient.getSkills()`, `buildPluginInfo` | **Replace** with `GET /mcp/skills.json` — a byte-equivalent mirror of `skills/list`, same pattern as `tools.json` / `prompts.json` / `resources.json`. Docs SPA and `@quartal/plugin-core` switch to the MCP shape (frontmatter + manifest). Delete `SkillsCatalog*` types. |
| `skills[]` in `/com.quartal.plugin/contents.json` | Docs SPA overview | Keep summaries, derived from the same catalog. |

Net effect: the invented catalog format disappears, MCP becomes the primary live delivery, and the
Agent Plugins package remains the offline/install delivery. Both derive from one `skills/` folder.

### Things to check while implementing

- Frontmatter validation: `SkillCatalog` warns (or fails under `strict`) on name/folder mismatch,
  symlinks, limits. Run it at **build time** in the codegen plugin so authors see errors in
  `astro dev`, not at runtime.
- Cache: `ttlMs`/`cacheScope: "public"` is right for anon plugins; for auth plugins whose skills
  are per-user (future "dynamic" skills) use `private`.
- Dynamic skills (`resources: "dynamic"`): a natural later feature for account-specific playbooks
  (e.g. a company's own payroll practices from Quartal Files). Hosts MAY refuse them; not for v1.
- Cross-server skills: a skill that references tools of another server — document that skill
  content should name tools by their MCP name.

---

## 2. Elicitation (MRTR)

### What changed in 2026-07-28

The server can no longer push `elicitation/create` over a stream. Instead `tools/call` (also
`prompts/get`, `resources/read`) returns

```json
{ "resultType": "input_required",
  "inputRequests": { "confirm": { "method": "elicitation/create",
      "params": { "mode": "form", "message": "Pay 1 240 € to Acme Oy?", "requestedSchema": { … } } } },
  "requestState": "<sealed blob>" }
```

and the client retries the **same** `tools/call` with `inputResponses` and the echoed
`requestState`. Two modes: `form` (flat schema: string/number/integer/boolean/enum/multi-select
enum only) and `url` (browser navigation; mandatory for passwords, API keys, payment credentials).
Actions: `accept` / `decline` / `cancel`. `requestState` is attacker-controlled: seal it (HMAC/AEAD),
bind it to the user, a TTL and the request params.

### How it maps to our TypeScript model

MRTR means **the tool method runs again from the top on retry** — there is no suspended promise.
The API must make that obvious rather than hide it. Proposal: an `ask` facility on the context
(the second, injected parameter that tool methods already receive):

```ts
export class Payments {
  /** Pays an invoice. */
  async payInvoice(input: { invoiceId: string }, ctx: QuartalPluginContext) {
    const invoice = await loadInvoice(input.invoiceId);          // runs on every attempt
    const answer = await ctx.elicit.form<PaymentConfirmation>("confirm", {
      message: `Pay ${invoice.total} € to ${invoice.payee}?`,
    });                                                             // 1st run: throws → input_required
    if (answer.action !== "accept") return { status: "cancelled" };
    return pay(invoice, answer.content.account);                    // 2nd run: continues here
  }
}

/** Shown to the user before payment. */
interface PaymentConfirmation {
  /** Account to pay from. */
  account: "operating" | "savings";
  /** I have checked the amount. */
  confirmed: boolean;
}
```

- `ctx.elicit.form<T>(key, …)` — returns the response if `inputResponses[key]` is present; otherwise
  throws an internal `InputRequiredSignal` that `PluginMcpHelper` turns into `inputRequired(...)`.
  Several `form` calls in one method accumulate (the first missing one throws; or collect all with
  `ctx.elicit.batch`).
- **The schema comes from the TS type argument.** The codegen plugin already resolves types with
  ts-morph; it finds `elicit.form<T>` call sites and emits the JSON Schema for `T` into the tools
  registry, keyed by tool + key. JSDoc → `title`/`description`, literal unions → `enum` /
  `oneOf {const,title}`, `@format email`, `@minimum`… The build **fails** if `T` uses anything
  elicitation forbids (nested objects, arrays of non-enum). Same type also validates the response
  with the existing Zod builder.
- `ctx.elicit.url(key, { url, message })` — for OAuth to a third party, payment, or entering a
  secret. Completion is learned only by the retry, so the method checks its own state
  (e.g. "is the secret now in `HubSecrets`?") and asks again if not. **Quartal Hub fit:** a hosted
  "enter secret" page that writes into `HubSecrets` is exactly the URL-mode pattern the spec
  recommends for API keys.
- `ctx.state` — small typed payload to carry between attempts (sealed into `requestState`), so the
  second run can skip expensive work. Sealing uses the SDK's `createRequestStateCodec`, bound to
  the user (`sub`), with a TTL; the secret comes from env (`QRTL_STATE_SECRET`, generated per
  deployment; Hub injects it). Without the secret the framework refuses to elicit.
- Side effects before an `elicit` run twice. Document the rule: **ask first, act after**; the
  linter/codegen can warn when an `elicit` follows an awaited call to a non-read-only tool method.

### Degradation

| Caller | Behaviour |
|---|---|
| Modern client with `elicitation.form` | Native form. |
| Modern client without it / legacy 2025 client (stateless, cannot receive push elicitation) | `ctx.elicit.form` resolves per a declared fallback: `{ fallback: "decline" }` (default — the tool proceeds as if declined and returns a message telling the model what to supply), or `{ fallback: "error" }` → `isError` result. Optional pattern: an optional input property (`confirm?: boolean`) that, when supplied, satisfies the ask without elicitation. |
| REST (`POST /api/...`) | Respond **HTTP 428 Precondition Required** with `{ inputRequests, requestState }`; the client retries with `inputResponses`/`requestState` in the body (or `Qrtl-Request-State` header). OpenAPI documents the 428 response. `@quartal/plugin-core` `PluginClient` gets an `onInputRequired` callback. |
| Widgets (MCP Apps) & `@quartal/plugin-embed` | Tool calls from a widget go through the host, which renders the elicitation. `plugin-embed`'s lite host (REST) must render the form itself → a small `<qrtl-elicitation-form>` built from the JSON schema (ui-plugin already renders forms from schemas in the docs tool tester). |
| Docs SPA tool tester | Same form renderer — free manual testing. |

---

## 3. Tasks

### What the extension is

- `io.modelcontextprotocol/tasks`; only `tools/call` can become a task. **The server decides** per
  call (no client opt-in parameter, no per-tool `taskSupport` in the new design); it may return a
  task only if the client declared the extension.
- `CreateTaskResult` (`resultType: "task"`, `taskId`, `status`, `ttlMs`, `pollIntervalMs`) must not be
  returned before `tasks/get` would succeed.
- States `working` → `input_required` ↔ `working` → `completed` | `failed` | `cancelled`.
  `tasks/get` (poll), `tasks/update` (answer `inputRequests` — elicitation *inside* a running task),
  `tasks/cancel` (cooperative). No `tasks/list`, no `tasks/result`.
- Optional push: `notifications/tasks` via `subscriptions/listen`.
- Clients send `Mcp-Name: <taskId>` so load balancers can route to the instance holding state.
- Every task request must be authorized; bind tasks to the creating principal.

### Why it is hard for us

Tasks need two things our deployments do not have today: **durable shared state** and **work that
outlives the HTTP response**. On Railway/Fly/Node a long-lived process can do both in memory (until
restart/scale-out). On Vercel `waitUntil` is capped by function max duration; on Cloudflare Workers
`waitUntil` is ~30 s — real long work needs Durable Objects / Workflows / Queues.

### Proposed TS model

```ts
/**
 * Builds the annual report.
 * @task pollInterval=5s ttl=1h
 */
async buildAnnualReport(input: { year: number }, ctx: QuartalPluginContext) {
  ctx.task.status("Collecting ledgers…");             // → statusMessage
  const ledgers = await collect(input.year);
  const ok = await ctx.elicit.form<Approve>("approve", { message: "Publish?" }); // → input_required
  ctx.task.throwIfCancelled();
  return publish(ledgers);
}
```

- `@task` JSDoc tag marks a method as task-capable (codegen → registry flag; the REST/OpenAPI docs
  show it as async). Inside a task, `ctx.elicit` **does** await (the method is suspended in-process
  and resumed by `tasks/update`) — the opposite of the MRTR re-run semantics, so the context must
  tell the author which mode it is in, and the same method must work both ways (MRTR when the client
  lacks the tasks extension → runs synchronously).
- A `TaskStore` interface in `qrtl.config` (`tasks: { store }`): `memoryTaskStore()` (dev and single
  Node instance), `durableObjectTaskStore()` (Cloudflare), and the **Hub task store** (Quartal Hub
  runs the job and owns state — the natural commercial offering, since it removes the hosting
  problem for plugin authors).
- REST mirror: `Prefer: respond-async` → `202 Accepted` + `Location: /api/tasks/<id>`;
  `GET /api/tasks/<id>`, `POST /api/tasks/<id>/input`, `DELETE /api/tasks/<id>`.
- Legacy clients: always synchronous (current behaviour).

**Recommendation:** design the `ctx` API (`ctx.task`, `ctx.elicit`) together now so elicitation does
not need re-shaping later, implement Tasks first with `memoryTaskStore` on Node targets, and make
serverless/Hub storage a separate phase. The SDK 2.4 has no tasks-extension helpers yet; check the
SDK release notes before hand-rolling the protocol.

---

## 4. File transfers (`io.modelcontextprotocol/files`)

### How the extension works

**Upload (into a tool):**
1. A top-level tool argument is an object schema marked `x-mcp-file: { accept, maxSize }` with
   properties `id`, `name`, `mimeType`, `size`, `digest {algorithm: "sha-256", value}`.
2. Call 1 carries metadata only. Server answers `resultType: "upload_required"` with one upload
   target per file (`url`, `headers`, `credentials: "omit"`, optional `method`/`form`) and a sealed
   `requestState`.
3. Claude PUTs the bytes directly to the URL (never through the model's context).
4. Call 2 repeats the arguments + `requestState`; the server checks the state (user, args, TTL,
   single use for non-idempotent tools), checks the staged bytes (size, digest, type), then runs.

**Download (out of a tool):** the result's
`_meta["io.modelcontextprotocol/files"].downloads[]` lists `name`, `mimeType`, `size`, `digest`,
`url` (self-authorizing, ~1 h, no redirects, Range support). Max 10 files.

**Constraints that shape the design:**
- **Only connectors installed from the Claude Connectors Directory** get file transfers; a connector
  added by URL silently gets none. Each upload/download **host must be approved by Anthropic**
  (`mcp-review@anthropic.com`); the MCP server's own host is allowed.
- Team/Enterprise owners must enable it; HIPAA/ZDR/CMEK/IP-allowlist orgs cannot.
- `server/discover` must answer within 2 s (serverless cold starts!), errors disable the extension
  for ~1 day.
- Experimental extension — expect breaking changes. Not in the SDK.

### Approach: one Quartal Files plugin, file references everywhere else

Because of the Directory and approved-host rules, file bytes enter and leave the agent world through
**a single plugin: Quartal Files**. It is the only Quartal plugin that implements the files
extension, the only one listed in the Connectors Directory for that reason, and its storage host is
the only one that needs Anthropic's approval. Every other Hub-targeting plugin works with **file
references** (`qrtl://` URIs, see [Quartal Files URIs](#quartal-files-uris)) and reads/writes the
bytes itself through `HubFiles` with the user's token.

```text
user attaches PDF in Claude
  └─► Quartal Files  saveFile({ file: <x-mcp-file>, path: "inbox/statement.pdf" })
        upload_required → Claude PUTs bytes to Hub Files storage → call 2 commits
        ◄── { uri: "qrtl://~/inbox/statement.pdf?version=v3", … }
  └─► Accounting plugin  importStatement({ statement: "qrtl://~/inbox/statement.pdf?version=v3" })
        ctx.hub.files.open(ref) → bytes via HubFiles (user's token)
        ◄── { report: "qrtl://~/reports/reconciliation.xlsx?version=v1" }
  └─► Quartal Files  downloadFile({ uri: "qrtl://~/reports/reconciliation.xlsx?version=v1" })
        ◄── _meta downloads[] with a signed Hub Files URL
```

Why this shape:
- **One Directory listing, one approved storage host.** No per-plugin review, no gateway that
  proxies every Hub plugin behind one connector.
- **The model never carries bytes** — only short reference strings between the two calls.
- **References are protocol-neutral.** The same `qrtl://` string works in MCP, REST, widgets and
  `plugin-embed`, and can be stored in a record (an invoice's attachment) — unlike an `x-mcp-file`
  argument, which only exists inside one MCP call.
- **Files and resources unify:** a file reference *is* the Files plugin's resource URI.

### The Quartal Files plugin (in the Quartal Files project, not this repo)

- Tools: `saveFile` (`x-mcp-file` input + target path → returns the reference),
  `downloadFile` (reference → `_meta` downloads), plus the existing list/read/search/move tools.
- Resources: the file system as `qrtl://` resources and templates (see
  [section 5](#5-resources-general)).
- A **skill** served over MCP (Skills over MCP, section 1) that teaches agents the two-step flow:
  "when the user gives a document to a Quartal tool, save it with Quartal Files first and pass the
  `qrtl://` reference; to hand a produced file to the user, call `downloadFile`."
- **Fallbacks** where Claude's file transfer is unavailable (connector added by URL, ChatGPT, orgs
  with transfers disabled, legacy clients):
  1. **The widget** — an MCP App with a file picker that uploads directly to a
     `HubFiles.getUploadUrl()` URL and shows/returns the reference; downloads via MCP Apps
     `app.downloadFile()`. To verify: file inputs inside the host sandbox, and the widget CSP
     `connect-src` for the Hub Files storage host.
  2. **The Files web app** — upload there, copy the reference.
  3. **Inline `data` (base64)** on the file object for small files (allowed by the extension).
- The storage host used for upload/download URLs must be stable (one hostname) so it can be
  approved once.

### What the framework (this repo) provides

- **`HubFileRef`** type in `@quartal/plugin/hub` — a branded string for `qrtl://` references. The
  codegen knows it (like `Date`): it emits `{ type: "string", format: "uri", pattern: "^qrtl://" }`
  with a standard description telling the agent to obtain the reference from Quartal Files.

  ```ts
  import type { HubFileRef } from "@quartal/plugin/hub";

  /** Imports a bank statement. */
  async importStatement(input: {
    /** The statement PDF. @accept application/pdf */
    statement: HubFileRef;
  }, ctx: QuartalPluginContext): Promise<{ report: HubFileRef }> {
    const hub = getExperimentalHubContext(ctx);
    const pdf = await hub.files.open(input.statement);    // checks owner/permissions, returns bytes + metadata
    …
    const written = await hub.files.upload("reports/reconciliation.xlsx", bytes);
    return { report: written.ref };
  }
  ```

- **`HubFiles.open(ref)`** / `parseRef` / `toRef` — resolve a reference (owner, path, optional
  version) with the user's token. Reads are always authorized by the token, never by the reference
  itself, so a leaked reference grants nothing. `@accept` is checked against the stored MIME type.
- `HubFileWriteResult` gains a `ref` (always version-pinned) so tools can return references directly.
- Widgets: expose `app.downloadFile()` through `@quartal/plugin/widget` (needs `ext-apps` ≥ 1.1.2;
  we have 2.x).
- **Also built (needed by the Files plugin itself):** generic `x-mcp-file` support — `McpFile`
  input type, the two-call `upload_required` protocol in `PluginMcpHelper`, and a `FileStaging`
  the plugin exports from `src/file-staging.ts` (sealed request state via
  `QRTL_REQUEST_STATE_SECRET`). Other plugins can use it too, but only Directory-listed connectors
  get transfers in Claude.

### Quartal Files URIs

```text
qrtl://<owner>/<path>[?version=<id>]
qrtl://~/<path>[?version=<id>]
```

- `<owner>` is the company's Quartal IAM id.
- **`~` means "the owner the token is for".** In production an OAuth token is almost always issued
  for a single organization, so agents, skills and users should not have to know or repeat the owner
  id. `~` is resolved from the token on every request, exactly like `HubFiles`' default owner (the
  user's selected company) works today; a token without a resolvable owner makes `~` an error
  (`-32602`), never a guess.
- Why `~`: it is the established "my home" shorthand (POSIX shells, `~/`), short enough that models
  reproduce it reliably, and it reads as "the current account's space" rather than as a person.
  It is an RFC 3986 *unreserved* character, so it is valid in the authority without escaping.
  Alternatives considered: `self` / `me` (read as the *user*, not the organization), `default` /
  `current` (longer, less conventional), and an empty authority `qrtl:///path` (the `file:///`
  convention — correct, but models and string-joining code mangle triple slashes).
- `?version=<id>` pins an immutable version. References that leave a tool call to be **stored or passed
  on** (upload results, report outputs) are version-pinned; references typed by people or agents
  usually are not.
- `~` is the form for everyday use (agent instructions, skills, resource listings for a single-org
  token). The explicit `<owner>` form is for multi-company tokens (an accountant serving several
  clients) and for references persisted outside the token's context. Tools accept both and echo the
  form they were given; `HubFiles.toRef(path, { explicitOwner: true })` produces the explicit one.
- Applies to Quartal Files in general — resources, tool inputs/outputs, the REST API and the web
  app's "copy reference" — not only to uploads.

---

## 5. Resources (general)

### Current state

Resources exist only for widgets (`ui://` MCP Apps templates), hand-written in `PluginMcpHelper`.
Skills over MCP will add `skill://` resources through the SDK.

### Proposal

- **`src/resources/` convention**, analogous to `src/prompts/`: classes whose methods become
  resources or resource templates.

  ```ts
  export class Policies {
    /**
     * The company's travel policy.
     * @uri policy://travel
     * @mimeType text/markdown
     */
    travel(): Promise<string> { … }

    /**
     * One expense category's rules.
     * @uri policy://expenses/{category}
     */
    expense(params: { category: ExpenseCategory }): Promise<string> { … }
  }
  ```

  `@uri` without placeholders → `resources/list` entry; with `{…}` → `resources/templates/list`, the
  parameter type drives completion (`completion/complete` from enum/literal unions). Return
  `string` → `text`, `Uint8Array` → `blob`, or a full `{ mimeType, text | blob }`. JSDoc
  `@cache 5m public` → `ttlMs`/`cacheScope`. Unknown URI → `-32602` (2026-07-28 code).
- **Tool results with `resource_link`**: let tools return `ctx.resources.link(uri)` so large content
  is not inlined; hosts read it on demand. Pairs well with Files.
- **Quartal Files as a resource provider** — served by the Quartal Files plugin, built on a reusable
  provider in `@quartal/plugin/hub` (`resources: [hubFiles({ drives })]` in `qrtl.config`) so other
  Hub plugins can expose a scoped part of the file system too. URIs follow
  [Quartal Files URIs](#quartal-files-uris): template `qrtl://~/{+path}` (plus the explicit-owner
  form for multi-company tokens); `resources/list` = drive roots / recent files (paginated) under
  `~`; `resources/read` = `HubFiles.getContent` (text → `text`, binary → `blob`, too big → error
  pointing to `downloadFile`). Per-user, so `cacheScope: "private"`. Later: dynamic skills stored in
  Quartal Files.
- **Subscriptions**: `subscriptions/listen` replaces `resources/subscribe`; only worth it once Files
  emits change events (`HubFiles.listChanges` exists). Not v1.
- REST mirror: `GET /mcp/resources.json` already exists; add `GET /api/resources?uri=…` for read.

### Client reality check

Resource support in hosts is uneven: Claude Code and Claude Desktop let users attach/@-mention
resources; claude.ai and ChatGPT mostly use resources for app UIs and (now) skills, not as general
model-readable context. So resources are **plumbing for skills, widgets and links** first, and a
user-facing feature second. That still justifies building the general mechanism now — skills force
the refactor anyway.

---

## 6. Other 2026-07-28 items to verify in `PluginMcpHelper`

- `ttlMs` / `cacheScope` are required on `server/discover`, `tools/list`, `prompts/list`,
  `resources/list`, `resources/read`, `resources/templates/list` — check what SDK 2.4 fills by
  default; set `public` + a few minutes for anon plugins, `private` when auth is on.
- `tools/list` must be deterministically ordered — sort by name.
- Resource-not-found is now `-32602`; our widget `resources/read` throws a plain `Error`.
- `server/discover` latency (≤ 2 s for file transfers) on cold starts — keep discovery free of I/O.
- Deprecated: `logging` capability (keep only for legacy fallback), sampling, roots, DCR (prefer
  CIMD — already used with Keycloak).
- **Enterprise Managed Auth** extension — relevant for the `quartal-hub` auth mode; evaluate with the
  Hub team.
- `x-mcp-header` (tool params mirrored to `Mcp-Param-*` headers) — not needed now.

## 7. Proposed phases

1. **Skills over MCP** — `McpServer` refactor, `SkillCatalog` attach, `/mcp/skills.json` mirror,
   drop `catalog.json` / `SkillsCatalog` types / `.skill` (after verifying), docs-web + plugin-core
   switch, build-time skill validation, website docs. Small, ship now.
2. **`ctx.elicit` (form + url) with MRTR**, request-state codec + secret, codegen of elicitation
   schemas from type arguments, REST 428 mapping, form renderer in ui-plugin/plugin-embed.
3. **General resources** (`src/resources/`, `resource_link` results), the **`qrtl://` URI scheme**
   (`~` = owner from token) and the **Quartal Files resource provider**.
4. **File transfers** — here: `HubFileRef`, `HubFiles.open/parseRef/toRef`, `ref` on write results,
   `app.downloadFile()` in the widget API. In the Quartal Files project: `saveFile`/`downloadFile`
   with the files extension, the upload/download widget, the two-step skill, and the Connectors
   Directory listing + storage-host approval with Anthropic.
5. **Tasks** — `@task`, `ctx.task`, `memoryTaskStore` on Node targets; then Durable Objects / Hub task
   store.

## Open questions

- Sub-server skill assignment (`mcp.servers[].skills`) — or skills on the main server only?
- REST status for input-required: 428 (proposed) vs 200 with `resultType`.
- Does Claude Desktop still need the `.skill` extension for manual import?
- Can a widget inside Claude's MCP Apps sandbox open a file picker and upload to the Hub Files
  storage host (the Files plugin's fallback path)?
- How reliably do agents chain Quartal Files → another plugin from the skill alone, without the
  target plugin's tool description repeating the instruction?
- Where the request-state secret lives for self-hosted plugins (env var, auto-generated in
  `deploy-plugin`).
