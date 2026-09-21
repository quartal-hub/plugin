---
title: "Deploy to Vercel"
description: "Step-by-step: swap in the Vercel adapter and deploy preview + production."
section: deploying
order: 2
---

Vercel runs the plugin as a serverless function on the Node.js runtime. The only change from a
plain plugin project is the adapter — with `@quartal/plugin` **0.9.0 or newer**, everything the
plugin serves (generated metadata, configuration, skills, agents, README) rides inside the server
bundle, and `public/` files are served by Vercel's static layer automatically.

## 1. Install the Vercel adapter

In your plugin project (as created by `pnpm create @quartal/plugin`):

```bash
npm install @astrojs/vercel
```

## 2. Update `astro.config.mjs`

Replace the Node adapter with the Vercel adapter:

```js
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import qrtlPlugin from "@quartal/plugin/astro";

export default defineConfig({
  output: "server",
  adapter: vercel(),
  integrations: [qrtlPlugin()],
});
```

If your project uses a widget framework, keep its integration (`vue()`, `react()`, …) in
`integrations` — only the adapter line changes.

## 3. Deploy

```bash
npx vercel login     # once
npx vercel           # deploys a preview; the first run creates the project
```

The CLI prints a preview URL. When it looks right:

```bash
npx vercel --prod
```

## 4. Environment variables (auth plugins only)

If your plugin uses `auth: "custom"`, set the `OAUTH_*` variables before deploying, once per
environment:

```bash
npx vercel env add OAUTH_ISSUER
```

Repeat for the other variables from [Authentication](/docs/auth/authentication). Vercel keeps
separate values for the `production`, `preview` and `development` environments — this is also the
natural test/production split: previews are your test environment, `--prod` is production.

## 5. Verify

```bash
curl https://<your-deployment>.vercel.app/plugin.json
```

Then open the deployment URL in a browser: the docs site should show your tools, skills and
agents. If routes answer 500, check the function logs in the Vercel dashboard; the most common
cause is an outdated `@quartal/plugin` (0.9.0 or newer is required on Vercel).

## Notes

- Vercel's Hobby plan does not allow commercial use; a commercial plugin needs a Pro team.
- A custom domain is a CNAME: add the domain in the Vercel project settings and create the DNS
  record it prints.
