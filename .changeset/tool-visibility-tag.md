---
"@quartal/plugin-core": minor
"@quartal/plugin": minor
---

Add the `@visibility` JSDoc tag for tools (MCP Apps `_meta.ui.visibility`): `model` and/or `app`
scopes, advertised in `tools/list` so hosts can hide widget-only helper tools from the model.
New `McpToolVisibility` type and optional `visibility` on `McpToolDescriptor` / `CodeFunction`.
