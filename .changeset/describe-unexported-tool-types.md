---
"@quartal/plugin": patch
"@quartal/create-plugin": patch
---

Codegen describes every type that a tool signature reaches, also one that `src/tools/mod.ts` does not export. A
type declared under `src/tools/` but not exported from `mod.ts` (or a subtype of an exported type that is not
exported) used to resolve to an empty schema without a message; it now gets its properties and JSDoc descriptions
in `open-api.json` and the MCP tool schemas like any other type. The tools documentation has a new "Where the
types live" section, and the `AGENTS.md` of a new plugin tells coding agents where the tool types go.
