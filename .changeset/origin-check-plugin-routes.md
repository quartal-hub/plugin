---
"@quartal/plugin": patch
---

Cross-origin calls to the plugin routes (e.g. a body-less `DELETE /api/...`) are no longer rejected with `403` by Astro's CSRF protection in deployed plugins: the integration sets `security.checkOrigin: false` and applies the same origin check itself to the requests Astro renders (your own pages, endpoints and actions), so `security.checkOrigin: false` is not needed in `astro.config.mjs`.
