---
"@quartal/plugin-core": minor
"@quartal/plugin": minor
"@quartal/create-plugin": patch
---

Tools can declare how they behave with the `@readOnly`, `@destructive`, `@idempotent` and `@openWorld` JSDoc tags
(`@destructive false` and the like set a hint to false). They are advertised in the MCP `tools/list` result as the
standard tool `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`). Without them a
host has to assume that every tool may change or delete data, and a host such as Claude asks the user to approve
each call; a tool marked `@readOnly` can run without that prompt. `McpToolAnnotations` is exported from
`@quartal/plugin-core`. The tools guide documents the tags, and the `AGENTS.md` of a new plugin tells coding agents to
mark tools that only read.
