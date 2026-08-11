# @quartal/plugin-core

Core types and HTTP client for Quartal Plugins: the shared model consumed by `@quartal/plugin` (the
authoring framework) and the lightweight client for connecting to a plugin published on the web.
Deliberately low-level and dependency-free — Quartal Hub-specific functionality (auth, user
management, reports, …) belongs in the separate `@quartal/hub` library.

## Deno (JSR)

```ts
import { createPluginClient, type PluginInfo } from "@quartal/plugin-core";

const client = createPluginClient({ baseUrl: "https://my-plugin.example.com" });
const plugin: PluginInfo = await client.getPlugin();
```

## npm

```bash
cd @quartal/plugin-core
npm install
npm run build   # tsc → dist/ (.js + .d.ts); runs automatically on `npm publish` via prepublishOnly
```

The npm build is plain `tsc` (`tsconfig.build.json`). The sources keep Deno-style explicit `.ts`
import extensions; TypeScript's `rewriteRelativeImportExtensions` (5.7+) rewrites them to `.js` in
the emitted JavaScript, so the same sources serve both the Deno (JSR, via `src/mod.ts`) and npm
(`dist/mod.js`) consumers — no `@deno/dnt` and no Deno required to build.

Consumed by the `@quartal/plugin` Astro integration, the docs SPA, and plugin widget helpers.
