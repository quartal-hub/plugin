---
"@quartal/plugin": major
"@quartal/plugin-core": minor
---

The plugin's own MCP resources.

- Methods of classes exported from `src/resources/mod.ts` are MCP resources: `@uri` gives the URI (a URI with `{variables}` is a resource template whose variables are the method's input properties), `@mimeType` the content type and `@cache 5m [public]` the cache hint. A string is served as text, bytes as a blob, `{ text | blob, mimeType }` as given, anything else as JSON (`application/json`). Without `@mimeType`, the listed MIME type is inferred from the method's return type.
- The code generator writes `mcp-resources.json` and `resources.registry.ts`; the generated middleware passes `resourceModules` to the app. A method without `@uri`, a duplicate URI or a template variable missing from the input fails the build.
- Resources are served on the main MCP server next to widgets and skills, and listed in `GET /mcp/resources.json` and the plugin overview.
- Prompts and resources receive the call's context as their second parameter, like tools.
- `@quartal/plugin-core`: `McpResourceDescriptor`, `McpResourcesDocument`, `CodeResourceDeclaration` and `CodeFunction.resource`.
