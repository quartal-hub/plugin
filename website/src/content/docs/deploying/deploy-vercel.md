---
title: "Vercel"
description: "Deploy to Vercel.com, which provides probably the easiest inegrations to Astro.build"
section: deploying
order: 2
---

Vercel runs the plugin as a serverless function on the Node.js runtime. The only change from a
plain plugin project is the adapter — with `@quartal/plugin`.

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
agents. If routes answer 500, check the function logs in the Vercel dashboard.
