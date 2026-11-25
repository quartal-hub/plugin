---
"@quartal/plugin": major
"@quartal/plugin-core": major
"@quartal/plugin-docs-web": minor
"@quartal/ui-plugin": patch
"@quartal/create-plugin": patch
---

Skills over MCP.

- The main MCP server serves the plugin's `skills/` folder with the MCP Skills extension (`io.modelcontextprotocol/skills`): `skills/list`, `skills/get` and the `skill://<name>/<path>` resources, each skill with a SHA-256 file manifest. Skills are validated by the SDK's skill catalog (name equals folder, frontmatter, 512 files / 16 MiB); an invalid skill is left out with a warning.
- `GET /mcp/skills.json` mirrors `skills/list`. Skill files stay available at `/skills/<name>/<path>` and `/skills/<name>.zip`. There is no `/skills/catalog.json` and no `.skill` download.
- The MCP server is built on the SDK's `McpServer`; widgets are one `ui://widgets/{toolId}.html` resource template.
- `@quartal/plugin-core`: `ListSkillsResult`, `McpSkill`, `McpSkillResource` and `SkillFrontmatter` describe the MCP shapes; `PluginClient.getMcpSkills()` fetches the mirror and `skillHttpUrls()` maps an entry to its HTTP files and zip. `PluginLinks.skills` replaces `skillsCatalog`. `discoverSkills(baseDir)` and `skillsFromFileMap(files)` return `SkillEntry[]`; `registerSkillRoutes(app, root, { fileMap })` no longer takes a manifest.
