---
"@quartal/plugin": minor
---

`qrtl.config.ts` `auth` now also takes an object form: `{ mode, issuer?, scope?, audience?, resource? }`.
The values are app defaults for the OAuth resolution — per field, the `OAUTH_*` environment
variables still override them, and the mode's built-ins fill whatever is left
(`quartal-hub` keeps its zero-config test-environment values). As part of this,
`quartal-hub` mode now honors `OAUTH_AUDIENCE`, `OAUTH_SCOPE` and `OAUTH_RESOURCE`
in addition to `OAUTH_ISSUER`. New exports: `QrtlAuthMode`, `QrtlAuthConfig`,
`toQrtlAuthConfig`; `resolveOAuthOptions` and `oauthAuthMiddleware` accept the
app defaults as a third parameter.
