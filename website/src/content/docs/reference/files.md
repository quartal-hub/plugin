---
title: "Files in and out of tools (experimental)"
description: "Receive uploaded files and offer downloads with the MCP files extension, or pass Quartal Files references between plugins."
section: reference
order: 5
---

> **Experimental.** Quartal Files references, the MCP files extension and the APIs on this page
> may change at any time, without a version marked as a breaking change.
>
> Quartal Files is a Quartal Hub service. Quartal Hub is now piloting with selected Advisors and
> Enterprise customers in Finland. [Register at hub.quartal.com](https://hub.quartal.com/) for
> early access.

There are two ways for a tool to work with a user's files:

- **Quartal Files references** — the recommended way for plugins on Quartal Hub. The user's file
  lives in Quartal Files; tools pass a short `qrtl://` reference and read the bytes with the
  user's own rights.
- **The MCP files extension** (`io.modelcontextprotocol/files`, experimental) — the client sends
  the file's bytes to the plugin itself. Claude supports it for connectors installed from the
  Connectors Directory, with storage hosts Anthropic has approved.

## Quartal Files references

A reference names a file and, optionally, a version:

```text
qrtl://~/inbox/statement.pdf?version=v3
qrtl://<company-id>/inbox/statement.pdf
```

`~` is the company the caller's token is for — usually the only one, so references rarely need the
company id. The first path segment is the drive. Pin a version (`?version=`) in references you
store or pass on, so the file cannot change under them.

```ts
import type { HubFileRef } from "@quartal/plugin/hub";
import { getExperimentalHubContext } from "@quartal/plugin/hub";

export class Statements {
  /**
   * Imports a bank statement. Save the user's PDF with Quartal Files first and pass its reference.
   * @param input The statement.
   */
  async importStatement(input: { /** The statement PDF (`qrtl://…`). */ statement: HubFileRef }, ctx: QuartalPluginContext) {
    const files = getExperimentalHubContext(ctx).files;
    const { entry, bytes } = await files.open(input.statement, { accept: ["application/pdf"] });
    const written = await files.write("/reports/reconciliation.csv", toCsv(parse(bytes)));
    return { report: files.refOf(written.entry) };
  }
}
```

`files.open(ref)` reads with the caller's token, so a reference grants nothing by itself.
`files.refOf(entry)` gives the version-pinned reference of a written file (`~` form; pass
`{ explicitOwner: true }` for one you store outside the user's context). The Quartal Files plugin
uploads the user's files and offers downloads; its skill tells agents to save a file there first
and pass the reference on.

## The MCP files extension

Type a tool input property as `McpFile`:

```ts
import type { McpFile } from "@quartal/plugin/files";
import { offerDownload, readMcpFile } from "@quartal/plugin/files";

export class Statements {
  /**
   * Imports a bank statement.
   * @param input The statement.
   */
  async importStatement(input: {
    /**
     * The statement PDF.
     * @accept application/pdf
     * @maxSize 20MB
     */
    statement: McpFile;
  }, ctx: QuartalPluginContext) {
    const bytes = await readMcpFile(ctx, input.statement);
    // …
    offerDownload(ctx, { name: "report.csv", mimeType: "text/csv", size, digest, url, credentials: "omit" });
    return { rows: 42, report: "report.csv is offered for download" };
  }
}
```

- The property is marked `x-mcp-file` in the tool's input schema. `@accept` (MIME types,
  `type/*`, or `.ext`), `@maxSize` (`512KB`, `20MB`) and `@requireDigest` are copied into it.
  `McpFile[]` accepts several files.
- The framework receives the bytes **before the tool runs** and checks the size, the type and the
  SHA-256 digest when the client sends one. `readMcpFile(ctx, file)` returns them.
- Small files may come inline (base64 `data`, up to 4 MiB per call). Larger ones are uploaded to the
  plugin's **file staging**: the first call answers `upload_required` with one upload target per
  file, the client sends the bytes there and calls the tool again.
- `offerDownload(ctx, …)` lists a file in the result's `_meta` for clients that support downloads.
  Describe the file in the result too — other clients only see that.
- Over REST, `McpFile` arguments are sent inline with `data`.

### File staging

To receive uploads, export `fileStaging` from `src/file-staging.ts` and set the
`QRTL_REQUEST_STATE_SECRET` environment variable (at least 32 characters, the same on every
instance — it seals the state between the two calls):

```ts
// file: src/file-staging.ts
import type { FileStaging } from "@quartal/plugin/files";

export const fileStaging: FileStaging = {
  /** A signed, single-use upload URL into a staging area. */
  async createUpload(file, call) {
    const { url, key } = await myStorage.presignPut({ size: file.size, contentType: file.mimeType });
    return { key, target: { url, credentials: "omit", headers: { "Content-Type": file.mimeType } } };
  },
  /** The bytes uploaded to a target, or undefined when none arrived. */
  async read(key, call) {
    return myStorage.get(key);
  },
};
```

`call` carries the tool name, its arguments and the caller's context (the signed-in user), so a
staging can put the upload where the tool will need it. Upload targets should accept a single write
of at most the declared size, and staged bytes should be removed when they are not used within ten
minutes. Without a file staging, tools accept files inline only.

A storage that checks uploads itself — for example a content-addressed store keyed by the SHA-256
(add `@requireDigest` to the property) — can implement `confirm(key, file, call)` instead of `read`:
the framework then does not load the bytes, and the tool gets the staged key with
`stagedFileKey(ctx, file)` to move them into place.
