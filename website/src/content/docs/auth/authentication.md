---
title: "Authentication"
description: "Anonymous by default, Quartal IAM with one line of config, or any standards-compliant OAuth2 / OIDC server."
section: creating
order: 7
---

A plugin has one authentication mode, set with `auth` in `qrtl.config.ts`. It applies to the
whole server app — both the REST API (`/api/*`) and the MCP server(s) (`/mcp`). Documentation
pages, widget pages and static assets always stay public (the sandboxed widget iframe carries no
credentials).

## Anonymous by default

```ts
export default defineQrtlConfig({
  auth: "anon", // the default — you can omit it
});
```

With `"anon"` (the default) there is no authentication at all: anyone who can reach the plugin can
call every tool. This is the right mode for public data, demos and internal services behind their
own network boundary. Tool methods receive only their input parameter.

## Quartal IAM: one line

```ts
export default defineQrtlConfig({
  auth: "quartal-iam",
  deploy: { org: "my-org", app: "my-plugin" },
});
```

`"quartal-iam"` connects the plugin to the **Quartal IAM Server**, the integrated authentication
server of Quartal Hub. That's the whole setup — everything else derives from the plugin name:

- Incoming requests to `/api/*` and `/mcp` must carry an OAuth2 **JWT bearer token**, verified
  against Quartal IAM.
- Tool methods get a **`QuartalPluginContext`** as their second parameter: `uid`, `email`, `orgs`,
  an `avatar` (display name, initials, picture) and the raw `token` for calling downstream APIs.
- MCP clients such as Claude discover the login flow automatically: the plugin serves the OAuth
  Protected Resource Metadata document (RFC 9728) and answers unauthenticated calls with a
  standards-compliant `WWW-Authenticate` challenge, so the client registers itself and sends the
  user through the normal browser login.
- The Swagger UI on the plugin's docs site gets an *Authorize* dialog for testing with a real
  login.

The scaffolder sets this up for you: answer yes to the authentication question (or pass `--auth`
to `pnpm create @quartal/plugin`).

## Connecting to a custom OAuth2 server

The `"quartal-iam"` mode is generic OAuth2 / OIDC under the hood — Quartal IAM is simply its
default issuer. To use your own authorization server, keep `auth: "quartal-iam"` and override the
defaults with **environment variables**:

| Variable | Required | Purpose |
|---|---|---|
| `OAUTH_ISSUER` | yes | The authorization server's issuer URL — the expected `iss` claim, and the base for OIDC discovery (`<issuer>/.well-known/openid-configuration`). |
| `OAUTH_AUDIENCE` | one of these | The expected `aud` claim of incoming access tokens. Defaults to `OAUTH_RESOURCE`. |
| `OAUTH_RESOURCE` | one of these | The canonical URI of this plugin as an OAuth resource server (RFC 8707), e.g. `https://my-plugin.example.com`. Published in the resource metadata; also the default audience. |
| `OAUTH_SCOPE` | no | Scope(s) this plugin requires (space-separated). Advertised in the 401 challenge and the resource metadata. Defaults to the unscoped plugin name; the OIDC user-info scopes `profile email` are always added. |
| `OAUTH_JWKS_URI` | no | Explicit JWKS endpoint. Default: discovered from the OIDC configuration. |
| `OAUTH_TOKEN_URL` | no | Explicit token endpoint (used by the Swagger UI *Authorize* dialog). Default: discovered. |
| `OAUTH_CLIENT_ID` | no | Client id pre-filled in the Swagger UI *Authorize* dialog (default `swagger-test-client`). |

Set the variables in the shell / hosting platform the plugin runs in — for local development, for
example:

```bash
OAUTH_ISSUER=https://auth.example.com/realms/my-realm OAUTH_RESOURCE=http://localhost:4321 pnpm dev
```

### What the OAuth server must provide

Any standards-compliant OAuth2 / OIDC server works, as long as it can:

1. **Serve OIDC discovery** at `<issuer>/.well-known/openid-configuration` with a `jwks_uri` and
   `token_endpoint` (or you set `OAUTH_JWKS_URI` / `OAUTH_TOKEN_URL` explicitly).
2. **Issue JWT access tokens** signed with `RS256` or `ES256`, with the `iss` claim matching the
   issuer and the `aud` claim matching your configured audience/resource (RFC 8707 resource
   indicators).
3. Ideally include the standard user-info claims — `sub`, `email`, `name` /
   `preferred_username`, `picture` — which map to the `QuartalPluginContext` your tools receive.
4. For interactive MCP clients (Claude and others): support **dynamic client registration**, so
   the client can register itself after discovering the server through the plugin's RFC 9728
   metadata. Without it, you must pre-register each client manually.

Commonly used servers that do the job:

- **Auth0 / Okta** — set the API *identifier* to your resource URI so tokens carry the right
  `aud`; dynamic client registration is supported.
- **Microsoft Entra ID** — expose the plugin as an API (application ID URI = audience).
- **Zitadel, Authentik, Ory Hydra** — standards-compliant OIDC with JWT access tokens.
- **Keycloak** — what Quartal IAM itself runs on. Use an audience mapper for the `aud` claim;
  Keycloak 26+ supports MCP-style dynamic clients behind the `cimd` feature flag.

### Can these be set in `qrtl.config.ts`?

No — deliberately. `qrtl.config.ts` sets only the *mode* (`auth: "anon" | "quartal-iam"`); the
OAuth details stay out of it because they are deployment-specific — a staging and a production
deployment of the same plugin use different issuers, resource URIs and client ids, and those
belong in each environment rather than in a file committed to the repository. Use environment
variables per deployment.

If you host the plugin app programmatically (outside the Astro integration), you can pass a typed
`OAuthOptions` object to `getAuthApp(config, oauth)` instead — it supports everything the
environment variables do, plus overrides such as `algorithms`, `additionalScopes` and a custom
`claimsToContext` mapper from JWT claims to the `QuartalPluginContext`.

## What is protected, exactly

| Surface | With `"quartal-iam"` |
|---|---|
| `POST /api/<Class>/<method>` | Bearer token required. |
| `ALL /mcp`, `/mcp/<server>` | Bearer token required; unauthenticated calls get the RFC 9728 challenge. |
| `GET /.well-known/oauth-protected-resource` | Public (this is how clients find your auth server). |
| Docs site, `/widgets/*`, `/widget-assets/*`, `public/` | Public. |

Changing `auth` is picked up on dev-server restart; `qrtl.config.ts` is watched, so saving it
restarts automatically. See also the [configuration reference](/docs/reference/configuration/).
