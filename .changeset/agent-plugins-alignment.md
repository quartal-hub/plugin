---
"@quartal/plugin": minor
"@quartal/plugin-core": minor
---

Align plugin outputs with the Agent Plugins 1.0 standard: `GET /plugin.json` serves the standard
manifest (the Quartal overview moved to `GET /com.quartal.plugin/contents.json`), `GET /mcp.json`
serves the standard `mcpServers` config, and `GET /plugin.zip` serves the whole installable
package (dual Claude manifests, skills, agents, README, Quartal extension). MCP list results are
also mirrored as REST (`GET /mcp/tools.json`, `/mcp/prompts.json`), and a plugin can declare
multiple named MCP servers — hosted at `/mcp/<name>` or external — via the `mcp.servers` section
of `qrtl.config`. `@quartal/plugin-core` carries the new manifest and multi-server model types.
