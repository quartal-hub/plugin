---
title: "Deploy to Cloudflare Workers"
description: "Not supported yet: what breaks today, what is planned, and what you can do meanwhile."
section: deploying
order: 4
---

> **⚠️ Quartal Plugins do not run on Cloudflare Workers yet.** The build succeeds and the Worker
> deploys, but every route answers 500. Support is planned — this page explains where it stands so
> you don't lose an afternoon finding out the hard way.

## Why it doesn't work yet

A Worker has no filesystem. `node:fs` exists (with Node compatibility enabled) but reads a virtual
filesystem containing only the modules bundled into the Worker. A Quartal Plugin currently reads
its metadata, `skills/`, `agents/`, `public/` files and the built-in docs site from disk at request
time — none of which exist inside a Worker. The framework has to move those reads to build time
before Workers can be a target, and that work is planned in `@quartal/plugin` (bundle-time
artifacts and asset-based file serving). This page will change to a real step-by-step guide when it
ships.

## What to use today

- **[Railway](/docs/deploying/deploy-railway)** — runs the scaffolded project unchanged.
- **[Vercel](/docs/deploying/deploy-vercel)** — serverless, with a small adapter/config change.
- Any host that runs a Node 22+ server (a container platform, Fly.io, a VM) also works with the
  default `@astrojs/node` adapter: build with `npm run build`, run
  `node ./dist/server/entry.mjs`, and keep the project directory as the working directory.

You can keep your DNS on Cloudflare either way — point a CNAME at the platform that hosts the
plugin.

## If you want to experiment anyway

The `@astrojs/cloudflare` adapter builds a valid Worker bundle from a plugin project, so you can
watch the failure mode locally without deploying anything:

```bash
npm install @astrojs/cloudflare wrangler
# swap the adapter in astro.config.mjs: adapter: cloudflare()
npm run build && npx wrangler dev
```

Expect every route to answer `500` — that is the known limitation, not a mistake in your plugin.
