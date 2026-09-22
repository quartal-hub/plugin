---
"@quartal/plugin": patch
---

The Astro integration injects a server-rendered catch-all route (`/[...qrtlPath]`, served from
the new `@quartal/plugin/astro/route` export) so the plugin's runtime paths — `/plugin.json`,
`/api/*`, `/mcp`, skills, agents, the docs page — are part of Astro's route table. On Vercel the
adapter mirrors that table into platform routing and forces status 404 on every path without a
route, which turned every plugin response into a 404 with a correct body. Unclaimed paths still
end at the project's 404 page.
