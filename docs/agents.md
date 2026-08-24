# Agents

An **Agent** is the fourth Quartal Plugin primitive, next to Tools, Widgets and Skills: a named
system prompt plus the tools, skills and runtime settings it expects. It answers the question
"who should run this, and with what?" — where a Tool answers "what can be called" and a Skill
answers "how should this be done".

Agents are authored under `<plugin>/agents/` and modeled on the
[Claude agent format](https://code.claude.com/docs/en/plugins-reference#agents) /
[sub-agents](https://code.claude.com/docs/en/sub-agents), so a Quartal plugin can be installed as
a Claude plugin without a conversion step. Everything Claude-specific is *resolved* into a
host-neutral form on the way out: models carry their provider, colors carry Bootstrap and CSS
equivalents, and every tool name says where the tool comes from.

## Authoring

```
my-plugin/
  agents/
    invoice-writer.md      ← Claude-format markdown: YAML frontmatter + system prompt
    invoice-monitor.json   ← same fields as JSON, with the prompt in `prompt`
  skills/
  src/tools/
```

The file stem is the agent name unless the frontmatter says otherwise. `README.md` and `about.md`
inside `agents/` are treated as documentation and skipped. `description` is required; everything
else is optional.

```markdown
---
name: invoice-writer
description: Use this agent to draft an invoice from a free-form description of the work done.
model: sonnet
color: primary
effort: medium
maxTurns: 20
permissionMode: plan
tools:
  - createInvoice
  - listInvoices
  - Read
  - mcp__company-registry__searchCompanies
disallowedTools: Write, Edit, Bash
skills: [invoicing-rules]
mcpServers:
  company-registry:
    type: http
    url: https://prh-opendata.example.com/mcp
    description: Company lookups for the payer details.
initialPrompt: What should I invoice, and to whom?
---

# Invoice writer

You draft invoices. …
```

### Fields

| Field | Authored as | Resolved to |
|---|---|---|
| `name` | lowercase letters, digits, single hyphens | unchanged; defaults to the file stem |
| `description` | one sentence: what it does and when to delegate to it | unchanged (**required**) |
| *body* | markdown after the frontmatter | `prompt` — the system prompt |
| `initialPrompt` | text | `initialPrompt` — auto-submitted first user turn |
| `tools` | comma string or YAML list | `AgentToolRef[]` with a `kind`: `plugin`, `environment`, `mcp`, `pattern` or `unknown` |
| `disallowedTools` | comma string or YAML list | same, applied before `tools` |
| `mcpServers` | name-keyed map or list | `AgentMcpServer[]` — **remote HTTP only** |
| `skills` | skill names of this plugin | `string[]`; unknown names are dropped with a warning |
| `model` | `sonnet`, `claude-opus-5`, `openai/gpt-5.1`, `inherit` | `AgentModelRef` with `provider`, `model` and a canonical `provider/model` id |
| `permissionMode` | `default`, `plan`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `manual` | unchanged |
| `maxTurns` | positive integer | unchanged |
| `effort` | `low`, `medium`, `high`, `xhigh`, `max` | unchanged |
| `isolation` | `worktree`, `none` | unchanged |
| `color` | Claude color, Bootstrap theme color, or raw CSS | `AgentColor` with `claude`, `bootstrap` and `css` where derivable |

Anything unusable — an unknown `effort`, a `stdio` MCP server, a skill this plugin does not ship —
is dropped with a warning rather than failing the agent, so one bad line never takes an agent out
of the catalog.

### Tool references

Tool names resolve in this order:

1. **Plugin tools** — the MCP tool ids of the plugin that ships the agent (`createInvoice`). This
   is the default: agents refer to their own package's tools by plain name.
2. **Environment tools** — names every host is expected to provide: `Read`, `Write`, `Edit`,
   `Glob`, `Grep`, `Bash`, `WebFetch`, `WebSearch`, `NotebookEdit`, `TodoWrite`, `Task`, `Agent`
   (exported as `ENVIRONMENT_TOOLS`).
3. **MCP server tools** — `mcp__<server>__<tool>`, where `<server>` should be one of the agent's
   own `mcpServers`. `mcp__<plugin>__<tool>` resolves back to a plugin tool.
4. **Patterns** — anything containing `*`, e.g. `disallowedTools: mcp__*`.

Unmatched names are kept verbatim with `kind: "unknown"` and a warning: the host may know tools
this plugin does not.

### Models

A value without a `/` is read as a Claude model — that is what keeps the Claude agent format
working unchanged — and always resolves to a provider-qualified id, so a non-Claude host never has
to guess:

| Authored | `provider` | `model` | `id` |
|---|---|---|---|
| `sonnet` | `anthropic` | `claude-sonnet-5` | `anthropic/claude-sonnet-5` |
| `claude-opus-5` | `anthropic` | `claude-opus-5` | `anthropic/claude-opus-5` |
| `openai/gpt-5.1` | `openai` | `gpt-5.1` | `openai/gpt-5.1` |
| `inherit` | — | — | — (`inherit: true`) |

The alias table is exported as `CLAUDE_MODEL_ALIASES` and can be overridden.

### External MCP servers

Only **remote streamable-HTTP** servers are accepted (`https:`, or `http:` on localhost). An agent
definition is data that travels between hosts, so it must never ask a host to spawn a local
process; `stdio`/`command` servers are rejected with a warning. Do not put secrets in `headers` —
the agent definition is served publicly.

## What a plugin serves

| Endpoint | Content |
|---|---|
| `GET /agents/catalog.json` | `AgentsCatalogResponse` — every agent, resolved, with absolute URLs |
| `GET /agents/<name>.md` | The Claude agent file: the authored markdown, or a rendering of a JSON agent |
| `GET /agents/<name>.json` | The resolved `AgentDefinition` |
| `GET /plugin.json` | `agents[]` summaries + `links.agentsCatalog` |

`@quartal/plugin-core`'s `PluginClient.getAgentsCatalog()` fetches the catalog.

## Claude compatibility notes

- Claude's **plugin-shipped** agents deliberately ignore `hooks`, `mcpServers` and
  `permissionMode` for security reasons. Quartal keeps all three in the catalog (a Quartal Hub or
  ToolLoopAgent host can honor them); a Claude host will simply drop them. `hooks` are not part of
  the Quartal model at all — a plugin should not ship executable lifecycle scripts.
- `memory` and `background` are recognized Claude fields that Quartal does not model yet.
- Skill references are plugin-local. Referring to a skill of *another* plugin is deferred.

## Implementing an agent host

The definition is deliberately declarative — running it is the host's job. For our current
runtime, Vercel AI SDK's
[`ToolLoopAgent`](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent), the mapping is:

| Field | ToolLoopAgent | Difficulty |
|---|---|---|
| `prompt` | `instructions` | direct |
| `model` | `model` — the canonical `provider/model` id is exactly what the AI Gateway takes | direct |
| `maxTurns` | `stopWhen: stepCountIs(n)` (SDK default is 20) | direct |
| `tools` (plugin) | entries of the `tools` record, built from the plugin's own MCP tools | direct |
| `tools` (subset) | `activeTools` | direct |
| `initialPrompt` | not a constructor setting — prepend it as the first user message on `generate()`/`stream()` | trivial, call-site |
| `mcpServers` | build an MCP client per server and merge `await client.tools()` into `tools`; HTTP transport is supported | easy, but the host owns client lifecycle and auth |
| `disallowedTools` | **no deny-list concept** — the host must subtract them while assembling `tools`/`activeTools`, and expand patterns like `mcp__*` itself | easy but caller-side; nothing enforces it inside the loop |
| `tools` (environment) | `Read`, `Grep`, `Bash`, … **do not exist in the AI SDK** — the host has to implement and register each one it claims to support | medium; this is the main portability gap |
| `effort` | no first-class setting; goes through `providerOptions` per provider (Anthropic thinking budget vs. OpenAI `reasoningEffort`) and needs a per-provider mapping | medium |
| `permissionMode` | no equivalent. AI SDK 6's `toolApproval` can express per-tool "ask before running", which covers `default` vs. `dontAsk`/`bypassPermissions`; `plan`, `acceptEdits`, `auto` and `manual` are host behaviors with nothing to map onto | hard / partial |
| `skills` | no concept in the AI SDK. The host has to implement preloading itself — inject the `SKILL.md` body into `instructions`, or expose a skill-loading tool | hard (host feature, not a setting) |
| `isolation: worktree` | nothing in the SDK; a sandbox/checkout concern outside the agent loop entirely | hard (infrastructure) |
| `color`, `name`, `description` | UI/registry metadata; only `id` has a loose counterpart | not applicable |

Short version: prompt, model, turn limit and plugin/MCP tools map onto `ToolLoopAgent` almost
one-to-one. `disallowedTools` and `initialPrompt` are trivial call-site work. The genuinely
missing pieces are **environment tools** (must be implemented per host), **skills preloading**,
**permission modes** and **worktree isolation** — a host that cannot honor those should report
them as unsupported rather than silently ignoring them.
