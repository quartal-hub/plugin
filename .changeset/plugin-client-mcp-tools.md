---
"@quartal/plugin-core": minor
---

`PluginClient.getMcpTools()` fetches `GET /mcp/tools.json`, the main MCP server's `tools/list` result, typed as `ListToolsResult`. New types: `Tool`, `ToolObjectSchema`, `ListToolsResult` and `McpToolUiMeta` (the MCP Apps `_meta.ui` of a tool). A request that the plugin answers with an error status throws a `PluginClientError`, which carries the requested `path` and the HTTP `status`.
