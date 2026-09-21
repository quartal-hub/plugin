---
title: "Deploy to Cloudflare Workers"
description: "Step-by-step: swap in the Cloudflare adapter and run the plugin as a Worker — early support."
section: deploying
order: 4
---

> **⚠️ Early support.** With `@quartal/plugin` **0.9.0 or newer** a plugin runs fully under
> Cloudflare's Workers runtime — verified with `wrangler dev` (tools, MCP, skills, agents, docs,
> widgets and the plugin download all serve). Real production deployments have not been broadly
> exercised yet, so treat your first `wrangler deploy` as a test and report what you find.

Workers have no filesystem, and from 0.9.0 a plugin needs none: the generated metadata,
configuration, skills, agents and README ride inside the Worker bundle, the docs page is fetched
from this site at runtime, and `public/` files are served as Workers static assets.

## 1. Install the adapter and wrangler

In your plugin project (as created by `pnpm create @quartal/plugin`):

```bash
npm install @astrojs/cloudflare wrangler
```

## 2. Update `astro.config.mjs`

Replace the Node adapter with the Cloudflare adapter:

```js
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import qrtlPlugin from "@quartal/plugin/astro";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  integrations: [qrtlPlugin()],
});
```

## 3. Add `wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "my-plugin",
  "compatibility_date": "2026-08-01",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true }
}
```

## 4. Build and verify locally

```bash
npm run build
npx wrangler dev
```

This runs the Worker in Cloudflare's actual runtime (workerd) on localhost. Check
`http://localhost:8787/plugin.json` and open `/` for the docs site.

## 5. Deploy

```bash
npx wrangler login   # once
npx wrangler deploy
```

The Worker gets a `*.workers.dev` URL; custom domains are added in the Cloudflare dashboard or
`wrangler.jsonc` (`routes`).

## Environment variables (auth plugins only)

If your plugin uses `auth: "custom"`, set the `OAUTH_*` variables as Worker secrets before the
deploy that needs them:

```bash
npx wrangler secret put OAUTH_ISSUER
```

## Notes

- Workers Free includes 100k requests/day; the paid plan is $5/month. Static assets are free.
- Astro sessions are not used by plugins, so no `SESSION` KV binding is needed; add one in
  `wrangler.jsonc` only if your own pages use `Astro.session`.
