---
"@quartal/plugin": minor
---

Build-time artifacts module: codegen now emits `qrtl-plugin/artifacts.ts`, an importable snapshot
of everything the runtime previously read from disk per request — the generated JSON artifacts
(tools, OpenAPI, types, contents, MCP tools/prompts), the resolved manifest, the README text, the
`qrtl.config` auth mode and `mcp` options, and the resolved widget entries. The generated Astro
middleware imports it and passes it to `getAnonApp`/`getAuthApp` via the new
`PluginAppConfig.artifacts` field (`PluginRuntimeArtifacts`). When present, the snapshot is
authoritative (no `qrtl.config` disk load, no runtime widget discovery); absent fields fall back
to the existing disk reads, so tests and non-Astro hosts keep working.

This makes bundled deployments self-contained: a serverless function or Worker serves the plugin's
metadata, docs, MCP catalog and widgets without `package.json`, `qrtl.config.*` or
`src/qrtl-plugin/*.json` existing on disk. Only `skills/`, `agents/`, `public/`, `README.md` (for
`/plugin.zip`) and the docs SPA assets still come from disk.
