---
"@quartal/plugin": major
"@quartal/plugin-core": minor
---

Files in and out of tools with the MCP files extension (`io.modelcontextprotocol/files`, experimental).

- `@quartal/plugin/files`: an `McpFile` tool input property is marked `x-mcp-file` (`@accept`, `@maxSize`, `@requireDigest` from JSDoc); `readMcpFile(ctx, file)` returns the bytes the framework received and checked (size, type, SHA-256) before the tool ran; `offerDownload(ctx, …)` lists a download in the result's `_meta` for clients that support downloads.
- Files arrive inline (base64 `data`, up to 4 MiB per call) or through the plugin's file staging: export `fileStaging` from `src/file-staging.ts` and set `QRTL_REQUEST_STATE_SECRET`; the first `tools/call` answers `upload_required` with the targets and a sealed request state, and the retry runs the tool with the staged bytes. The extension is declared in `server/discover`.
- REST accepts `McpFile` arguments inline.
- `@quartal/plugin-core`: `CodePropOrParam.file`.
