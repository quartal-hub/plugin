---
"@quartal/plugin": minor
---

Extension directories and the `site` configuration.

- A folder at the plugin root named after a reverse-domain namespace (`com.example.product/`) is an Agent Plugins extension directory: it is served at the same path, packaged into `/plugin.zip` and listed in `plugin.json` under `extensions["<namespace>"]` (`{ path, files }`).
- `qrtl.config` `site`: `root` chooses what `/` serves (`"docs"`, `"pages"` or `{ redirect }`), `access: "user"` puts the plugin's own pages behind a sign-in with the plugin's `auth`, and `public` lists the pages that stay open. A page reads the signed-in person from `Astro.locals.qrtlSession`; the browser has `GET /oauth/session` and `GET /oauth/logout`.
