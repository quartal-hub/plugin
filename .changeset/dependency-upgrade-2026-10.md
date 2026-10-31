---
"@quartal/plugin": minor
"@quartal/ui-plugin": minor
"@quartal/plugin-embed": patch
"@quartal/plugin-core": patch
"@quartal/plugin-vue": patch
"@quartal/create-plugin": patch
---

Dependencies moved to their current releases. The MCP stack is now v2 throughout: the widget
runtime uses `@modelcontextprotocol/ext-apps` 2.x, the docs site's tool tester connects with
`@modelcontextprotocol/client`, and the v1 `@modelcontextprotocol/sdk` is no longer a dependency
of any package. `@quartal/plugin` lists `@modelcontextprotocol/client` and `zod` as dependencies
because ext-apps needs them at runtime. Toolchain: TypeScript 6.0, Vite 8, Vitest 5, Astro 7.4
(which requires Node.js 22.23.4 or later), Vue Router 5, vue-tsc 3, Storybook 10.6. The
`@quartal/create-plugin` CLI declares the same Node.js requirement.

`@quartal/ui-plugin` ships a single bundled `dist/index.d.ts` again. Its types import `PluginInfo`,
`CodeType` and the other plugin metadata types from `@quartal/plugin-core`, which is now a dependency
of the package; the previous build wrote those imports as relative paths into the workspace sources,
which do not exist in the published package.
