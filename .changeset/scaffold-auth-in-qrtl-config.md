---
"@quartal/create-plugin": patch
---

Scaffolded projects configure the auth mode only in `qrtl.config.ts`; the generated
`astro.config.mjs` uses the bare `qrtlPlugin()` integration.
