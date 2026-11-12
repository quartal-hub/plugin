---
title: "Quartal Hub context (experimental)"
description: "Call the Quartal Hub services — the user's companies, secrets and files — from a tool, as the signed-in user."
section: reference
order: 4
---

> **For testing and prototypes only.** The Quartal Hub context, the services behind it and their
> URLs may change at any time, without a version marked as a breaking change. Do not build
> production plugins on it.

When a plugin signs users in through Quartal Hub (`auth: "quartal-hub"`, see
[Authentication](/docs/auth/authentication/)), a tool can call the Quartal Hub services as the
signed-in user:

| Service | What it gives a tool |
| --- | --- |
| `companies` | The companies the user is linked to, an Advisory's customers, and the company the user has selected to work in |
| `secrets` | The user's own secrets for integrations: passwords, API keys, certificates |
| `files` | A company's drives, folders, file contents, versions and search (read only) |

The services accept the user's Quartal Hub access token as it is: the context forwards the token
of the tool call, so there is nothing to configure. In any other auth mode the context is not
available.

## Getting the context

Import `getExperimentalHubContext` from `@quartal/plugin/hub` and call it with the tool's context
(the second parameter of every tool method):

```ts
import type { QuartalPluginContext } from "@quartal/plugin-core";
import { getExperimentalHubContext } from "@quartal/plugin/hub";

export class Reports {
  /** The reports of the selected company. */
  static async list(_input: unknown, ctx: QuartalPluginContext) {
    const hub = getExperimentalHubContext(ctx);
    const company = await hub.companies.getSelected();
    if (!company) return { company: null, reports: [] };
    return { company, reports: await hub.files.list("/data/raportit") };
  }
}
```

`getExperimentalHubContext` throws when the plugin does not run with `auth: "quartal-hub"` or the
call has no signed-in user. Get a new context in each tool call: it carries that call's user and
token.

## Companies

A user is linked to a company either directly (a membership with a role) or as a customer of an
Advisory (accounting firm) whose team the user belongs to. Access is resolved from the Quartal
directory on every call, never from the roles in the token.

| Method | Returns |
| --- | --- |
| `list({ via?, name?, stats? })` | The user's companies, one row per company, by name. `via`: `"direct"`, `"team"` or `"all"` (default) |
| `get(companyId)` | One company with the user's direct role and capabilities in it |
| `listCustomers(advisoryId, { query?, limit? })` | The customers of an Advisory the user is a direct member of |
| `getSelected()` | The company the user has selected, or `null` |
| `setSelected(companyId \| null)` | Selects a company (checked with `get` first), or clears the selection |

A company's id is its Quartal IAM id — the same id the Files service uses as the `owner` of the
company's files.

### The selected company

Many tools work in "the current company". Instead of asking for the company in every call, let the
user pick it once and store the choice with `setSelected`; later calls read it with `getSelected`,
and `files` uses it as the default `owner`:

```ts
export class Company {
  /** Selects the company to work in. */
  static async select(input: { companyId: string }, ctx: QuartalPluginContext) {
    return await getExperimentalHubContext(ctx).companies.setSelected(input.companyId);
  }
}
```

The selection is stored per user (the token's `sub`) in the plugin cache, so every MCP client,
REST call and widget of the same user on the plugin sees the same company. It is not shared with
other plugins. With the default in-memory cache, a selection lasts until the server instance
restarts — on serverless hosts that can be soon. Inject a durable cache with `setPluginCache()`
(for example Cloudflare KV) to keep it.

MCP has no standard way to carry a selection like this between tool calls: the protocol is
stateless and the client sends no session of its own. Two complements work well with the stored
selection:

- Return the selected company in tool results, so the model knows which company it is working in.
- In a widget, report the user's choice to the model with the MCP Apps `updateModelContext` call,
  and let the widget's tool store it with `setSelected`.

## Secrets

The user's own secrets, addressed by name (unique per user). No call can reach another user's
secrets.

| Method | Returns |
| --- | --- |
| `list()` | Names, kinds and metadata — never the values |
| `get(name)` | The secret with its value, or `null` |
| `put(name, { kind, value, metadata? })` | Stores the secret, replacing one of the same name |
| `delete(name)` | Whether a secret of that name existed |

```ts
const apiKey = (await getExperimentalHubContext(ctx).secrets.get("acme-api-key"))?.value;
```

Never return a secret's value in a tool result: everything a tool returns reaches the model.

## Files

Reads one company's files. Paths start with the drive, e.g. `/data/raportit/2026.md`; `/` lists the
drives. Every method takes an `owner` option — the company's Quartal IAM id — that defaults to the
selected company; with neither, the call throws.

| Method | Returns |
| --- | --- |
| `listDrives({ owner? })` | The company's drives |
| `list(path, { owner?, recursive?, limit? })` | The children of a folder, folders first |
| `getEntry(path, { owner? })` | One file or folder, without its content |
| `getContent(path, { owner?, version? })` | The content: text as `utf8`, anything else as `base64` |
| `getText(path, { owner?, version? })` | The content as text |
| `getDownloadUrl(path, { owner?, version?, expiresInSeconds? })` | A short-lived URL for large files or browser downloads |
| `listVersions(path, { owner?, limit? })` | The file's history, newest first |
| `glob(pattern, { owner?, drive?, cwd?, limit? })` | Files whose path matches a glob pattern |
| `grep(query, { owner?, drive?, cwd?, include?, caseInsensitive?, maxMatches? })` | Lines of text files that contain the text |

## Errors

A service that refuses a call throws a `HubApiError` with the HTTP `status` (for example 403 when
the user has no access to the company), the `method`, the `url` and the service's own message.

## Service URLs

The context calls the Quartal Hub test environment, the same one `auth: "quartal-hub"` signs users
in to. The URLs are exported as `EXPERIMENTAL_HUB_SERVICE_URLS`:

| Service | URL |
| --- | --- |
| Quartal IAM API (companies, secrets) | `https://iam-api-test.up.railway.app` |
| Quartal Files | `https://quartal-files-nine.vercel.app` |
