---
"@quartal/plugin": minor
---

OIDC discovery requires the discovery document's `issuer` to equal the configured issuer exactly (including any trailing slash) and HTTPS, except for `localhost`, `127.0.0.1` and `[::1]`. A plugin whose issuer fails these checks rejects every bearer token with 401, unless `jwksUri` / `OAUTH_JWKS_URI` is set.
