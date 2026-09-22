---
"@quartal/create-plugin": patch
---

Scaffolded plugins now depend on `@quartal/plugin@^0.9.0` and `@quartal/plugin-vue@^0.5.7`. The
`^0.8.0` range resolved to 0.8.0, whose runtime reads plugin files from disk and answers 500 on
every route when deployed to Vercel or Cloudflare Workers.
