---
"@quartal/plugin": minor
---

Docs-site login: authenticated plugins get a **Log in** button in the docs top bar, running the same OAuth flow MCP clients use (authorization code + PKCE with a CIMD client). The plugin serves its own client metadata document at `/.well-known/oauth/client-metadata.json`; `/oauth/login` starts the flow and `/oauth/callback` exchanges the code server-side, so no authorization-server CORS is needed. On localhost the shared metadata document on plugin.quartal.com is the client. The token is injected into Swagger UI *Try it out* requests; the Swagger security scheme is now plain HTTP bearer (the OAuth2 password flow and the `swagger-test-client` default are removed). `OAUTH_CLIENT_ID` now names a pre-registered public client for the docs login in `custom` mode (Auth0 / Entra ID, which lack CIMD).
