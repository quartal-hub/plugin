---
title: "Railway"
description: "Deploy as docker image to Railway. Similar approach works to other PaaS / container-based hosting environments (Heroku, Render, Fly.io)."
section: deploying
order: 3
---

Railway runs the plugin exactly as the starter kit builds it: a long-lived Node container where the
whole project directory — `skills/`, `agents/`, `public/`, `README.md`, the generated metadata —
sits on disk next to the server. No adapter change, no file lists. This makes Railway the simplest
target for a Quartal Plugin.

## 1. Add a start script

The scaffolded `package.json` has `dev`, `build` and `preview`; Railway needs `start`:

```json
"scripts": {
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "start": "node ./dist/server/entry.mjs"
}
```

## 2. Bind to all interfaces

Railway routes traffic to your container's `PORT`, so the server must not listen on localhost
only. In `astro.config.mjs`, add one line:

```js
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { host: true },
  integrations: [qrtlPlugin()],
});
```

The Node adapter reads `PORT` from the environment automatically.

## 3. Create the service and deploy

```bash
npm i -g @railway/cli
railway login
railway init            # create a project (or `railway link` an existing one)
railway add --service my-plugin
railway up
```

Railway builds the uploaded sources (`npm install` → `npm run build`) and starts the server with
`npm start`. Watch the build logs the CLI streams back.

## 4. Give it a URL

```bash
railway domain
```

This assigns a `*.up.railway.app` domain; custom domains are added in the service settings (a
CNAME record).

## 5. Environment variables (auth plugins only)

If your plugin uses `auth: "custom"`, set the `OAUTH_*` variables from
[Authentication](/docs/auth/authentication) on the service:

```bash
railway variables --set "OAUTH_ISSUER=https://iam.example.com/realms/my-realm"
```

## 6. Verify

```bash
curl https://<your-service>.up.railway.app/plugin.json
```

Then open the URL in a browser: the docs site should show your tools, skills and agents. A good
health-check path for the service settings is `/plugin.json`.

## Test and production

Run two services from the same repo (for example `my-plugin-test` and `my-plugin`), each with its
own variables and domain — or use Railway's per-environment feature within one project. Deploy to
a specific service with `railway up --service my-plugin-test`.
