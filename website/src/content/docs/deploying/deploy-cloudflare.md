---
title: "Cloudflare"
description: "Deploy to Cloudflare Workers, an even lighter-weight serverless runtime than Vercel."
section: deploying
order: 4
---

## 1. Install the adapter and wrangler

In your plugin project (as created by `pnpm create @quartal/plugin`):

```bash
npm install @astrojs/cloudflare wrangler
```

With pnpm, allow `workerd` (Cloudflare's runtime, installed by `wrangler`) to run its install
script when pnpm asks, or run `pnpm approve-builds` — otherwise `wrangler dev` cannot start.

## 2. Update `astro.config.mjs`

Replace the Node adapter with the Cloudflare adapter:

```js
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import vue from "@astrojs/vue";
import qrtlPlugin from "@quartal/plugin/astro";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  integrations: [vue(), qrtlPlugin()],
});
```

`@astrojs/vue` is only there because this project uses Vue widgets. Keep whatever integration your
project has (`react()`, or none at all) — only the adapter line changes.

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
