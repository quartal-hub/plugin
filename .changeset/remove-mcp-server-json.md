---
"@quartal/plugin": minor
"@quartal/plugin-core": minor
"@quartal/plugin-docs-web": patch
"@quartal/ui-plugin": patch
---

`GET /mcp-server.json` is gone. The MCP server's name, version, title, description, website and icons
are what the MCP `initialize` result returns, and the overview at `/com.quartal.plugin/contents.json`
lists the plugin's servers with their endpoints. `PluginLinks.mcpServer`, `PluginClient.getMcpServer()`
and the `McpServerInfo` type are removed with it; the docs site's MCP page shows the servers table for
every plugin instead of the separate server-info table.
