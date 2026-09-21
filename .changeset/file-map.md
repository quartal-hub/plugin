---
"@quartal/plugin": minor
---

Build-time file map: the artifacts module now carries the `skills/` and `agents/` trees
(`files: PluginFileMapEntry[]`, text inlined as UTF-8, binaries base64), and the runtime prefers
it everywhere — skill discovery, skill files and zip downloads (`skillsFromFileMap`), agent
discovery and markdown (`agentsFromFileMap`), and `/plugin.zip` (assembled from the map plus the
injected README). Directory walks remain the fallback for dev, tests and Node hosts.

With this, a deployed plugin needs no files on disk at all: serverless functions require no
`includeFiles`-style configuration, and a plugin serves fully under Cloudflare's Workers runtime
(verified with `wrangler dev` — tools, MCP, skills, agents, zips, widgets and the docs shell).
The docs-shell fetch also gained a 10-second timeout so an unreachable shell URL fails the docs
page soft instead of hanging requests.
