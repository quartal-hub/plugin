# @quartal/plugin-core

Core types and HTTP client for Quartal Plugins: the shared model consumed by `@quartal/plugin` (the
authoring framework) and the lightweight client for connecting to a plugin published on the web.

**No runtime dependencies.** This package ships types and a `fetch`-based client and nothing else —
its only `devDependency` is TypeScript, and it must stay that way. It sits at the bottom of the
dependency graph for every other `@quartal` package and is consumed from server, browser, and
bundler contexts alike, so anything added here is imposed on all of them. Quartal Hub-specific
functionality (auth, user management, reports, …) belongs in the separate `@quartal/hub` library.

## Usage

```ts
import { createPluginClient, type PluginInfo } from "@quartal/plugin-core";

const client = createPluginClient({ baseUrl: "https://my-plugin.example.com" });
const plugin: PluginInfo = await client.getPlugin();
```

## Building

```bash
pnpm install
pnpm run build   # tsc → dist/ (.js + .d.ts); also runs on publish via prepublishOnly
```

The build is plain `tsc` against `tsconfig.build.json`.

Consumed by the `@quartal/plugin` Astro integration, the docs SPA, and plugin widget helpers.
