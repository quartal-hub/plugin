---
title: "Deploy to Vercel"
description: "Step-by-step: swap in the Vercel adapter, include the plugin's runtime files, and deploy preview + production."
section: deploying
order: 2
---

Vercel runs the plugin as a serverless function on the Node.js runtime. Two things differ from a
plain Astro deployment: the function must **include the plugin's content files** (skills, agents,
public assets), and it needs `@quartal/plugin` **0.9.0 or newer** — from that version on, the
generated metadata, manifest and configuration ride inside the server bundle itself, and the
runtime locates the remaining files inside the relocated function at runtime.

## 1. Install the Vercel adapter

In your plugin project (as created by `pnpm create @quartal/plugin`):

```bash
npm install @astrojs/vercel
```

## 2. Update `astro.config.mjs`

Replace the Node adapter with the Vercel adapter, and pass it the content files the plugin serves
from disk at request time (the generated metadata and configuration are already inside the server
bundle and need no listing):

```js
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import qrtlPlugin from "@quartal/plugin/astro";

// The plugin serves these files per request; a Vercel function only contains
// traced modules, so they must be forced in via includeFiles.
const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])
    : [];
const includeFiles = [
  "README.md",
  ...walk("skills"),
  ...walk("agents"),
  ...walk("public"),
  // The built-in docs site served at "/".
  ...walk(join("node_modules", "@quartal", "plugin", "static", "plugin-docs-web")),
];

export default defineConfig({
  output: "server",
  adapter: vercel({ includeFiles }),
  integrations: [qrtlPlugin()],
});
```

If your project uses a widget framework, keep its integration (`vue()`, `react()`, …) in
`integrations` — only the adapter changes.

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
cause is a missing file in `includeFiles` (step 2) or an outdated `@quartal/plugin`.

## Notes

- Vercel's Hobby plan does not allow commercial use; a commercial plugin needs a Pro team.
- A custom domain is a CNAME: add the domain in the Vercel project settings and create the DNS
  record it prints.
