---
title: "Deploying a plugin"
description: "What a Quartal Plugin needs from a hosting platform, and how the platform guides fit together."
section: deploying
order: 1
---

A Quartal Plugin is an Astro server app (`output: "server"`): a small Node server that renders the
docs site and widget pages, and answers the REST, MCP, skill and agent routes on demand. Any
platform that can run or build a Node 22+ app can host one. These guides use the project exactly
as `pnpm create @quartal/plugin` scaffolds it — no access to the framework's source code is needed.

## What every deployment needs

1. **A build**: `npm run build` (Astro generates the `qrtl-plugin/` artifacts and the server
   bundle in `dist/`). The build captures everything the plugin serves — metadata, configuration,
   `skills/`, `agents/`, `README.md` — inside the server bundle, so the deployed app is
   self-contained on every platform (requires `@quartal/plugin` 0.9.0+).
2. **An adapter that matches the platform.** The scaffolded project uses `@astrojs/node` in
   standalone mode, which is right for platforms that run a long-lived Node server (Railway,
   Fly.io, a container, a VM). Serverless platforms need their own adapter — the platform guide
   tells you which line to change in `astro.config.mjs`.
3. **Environment variables, if your plugin uses `auth: "custom"`**: the `OAUTH_ISSUER`,
   `OAUTH_SCOPE`, … variables described in [Authentication](/docs/auth/authentication) must be set
   per environment on the platform. `auth: "anon"` and `auth: "quartal-hub"` need no variables.

## Platform guides

| Guide | Runs as | Status |
| --- | --- | --- |
| [Vercel](/docs/deploying/deploy-vercel) | Serverless function (Node runtime) | Supported |
| [Railway](/docs/deploying/deploy-railway) | Long-lived Node container | Supported |
| [Cloudflare Workers](/docs/deploying/deploy-cloudflare) | Worker (edge isolate) | **Early support** |

## Test and production environments

Run two environments of the same plugin as two deployments with different environment variables —
the platform guides show the idiomatic way on each platform (Vercel preview vs production
deployments; two Railway services). Nothing in the plugin itself is environment-specific: the same
build serves both.

## Verifying a deployment

Whatever the platform, the same checks tell you the plugin came up correctly:

```bash
curl https://your-plugin.example.com/plugin.json        # manifest
curl https://your-plugin.example.com/open-api.json      # one path per tool
curl https://your-plugin.example.com/skills/catalog.json
```

And open `/` in a browser — the built-in docs site should load with your plugin's name, tools,
skills and agents.
