---
"@quartal/plugin": patch
---

With a login (`auth` set), the MCP list mirrors `GET /mcp/tools.json`, `/mcp/prompts.json` and `/mcp/resources.json` (and the same under `/mcp/<server>/`) are public, like `/open-api.json`. The MCP protocol itself still requires the bearer token. This makes the docs Widgets page pre-fill the example input and snippets from the tool's input schema, and the MCP page's tool-count links work, for plugins that use login.
