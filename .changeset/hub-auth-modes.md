---
"@quartal/plugin": minor
---

Auth modes reworked: the authenticated mode is now `auth: "quartal-hub"`. It is zero-config — fixed Quartal Hub test-environment scope (`quartal-hub-test`), audience (`https://hub.test.qrtl.com`) and issuer, with only `OAUTH_ISSUER` overridable; the RFC 9728 `resource` derives from each request's origin so localhost and deployed instances need no configuration. A new `auth: "custom"` mode connects to any OAuth2 / OIDC server (Auth0, Microsoft Entra ID, …) via the `OAUTH_*` environment variables; `OAUTH_ISSUER` is required there. The `resolveOAuthOptions` / `oauthAuthMiddleware` second parameter is now the auth mode instead of a plugin name, and per-plugin-name scope/resource derivation is removed.
