---
title: "Authentication"
description: "Anonymous by default, Quartal Hub with one line of config, or any standards-compliant OAuth2 / OIDC server."
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

## Quartal Hub: one line

```ts
export default defineQrtlConfig({
  auth: "quartal-hub",
  deploy: { org: "my-org", app: "my-plugin" },
});
```

`"quartal-hub"` connects the plugin to the shared authentication of **Quartal Hub** (powered by
the Quartal IAM server). It is deliberately zero-config — every plugin uses the same fixed values:

| What | Value |
|---|---|
| Issuer | The Quartal Hub test IAM server (`https://iam2026.test.qrtl.com/realms/salaxy-test`) |
| Scope | `quartal-hub-test` (plus the OIDC user-info scopes `profile email`) |
| Audience | `https://hub.test.qrtl.com` (a fixed identifier, not a served URL) |
| Resource (RFC 9728) | Derived from each request's origin — `http://localhost:4321` in dev, the deployed URL in production, with no configuration |

What you get:

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

The only environment variable this mode honors is **`OAUTH_ISSUER`** — set it to point at another
Quartal IAM instance (e.g. a dev server). All other `OAUTH_*` variables are ignored; to control
those details, use `auth: "custom"`.

The scaffolder sets this up for you: answer yes to the authentication question (or pass `--auth`
to `pnpm create @quartal/plugin`).

> **Test tier.** The shared `quartal-hub-test` scope and audience mean a token issued for one
> quartal-hub plugin is currently valid at every quartal-hub plugin. That is acceptable for test
> data only. Before production use, this moves to per-plugin audiences — natively via RFC 8707
> resource indicators once Keycloak 26.8 ships them, otherwise via per-plugin client scopes
> provisioned at deploy time.

## Custom OAuth2 / OIDC server

```ts
export default defineQrtlConfig({
  auth: "custom",
});
```

`"custom"` is the same JWT bearer authentication with all details supplied by **environment
variables** — for connecting to your own authorization server (Auth0, Microsoft Entra ID,
Keycloak, Okta, Zitadel, …):

| Variable | Required | Purpose |
|---|---|---|
| `OAUTH_ISSUER` | yes | The authorization server's issuer URL — the expected `iss` claim, and the base for OIDC discovery (`<issuer>/.well-known/openid-configuration`). |
| `OAUTH_AUDIENCE` | one of these | The expected `aud` claim of incoming access tokens. Defaults to `OAUTH_RESOURCE`. |
| `OAUTH_RESOURCE` | one of these | The canonical URI of this plugin as an OAuth resource server (RFC 8707), e.g. `https://my-plugin.example.com`. Published in the resource metadata; also the default audience. When unset, the resource is derived from each request's origin. |
| `OAUTH_SCOPE` | no | Scope(s) this plugin requires (space-separated). Advertised in the 401 challenge and the resource metadata. The OIDC user-info scopes `profile email` are always added. |
| `OAUTH_JWKS_URI` | no | Explicit JWKS endpoint. Default: discovered from the OIDC configuration. |
| `OAUTH_TOKEN_URL` | no | Explicit token endpoint (used by the Swagger UI *Authorize* dialog). Default: discovered. |
| `OAUTH_CLIENT_ID` | no | Client id pre-filled in the Swagger UI *Authorize* dialog (default `swagger-test-client`). |

Set the variables in the shell / hosting platform the plugin runs in.

### Auth0

Create an **API** in the Auth0 dashboard (Applications → APIs). Its *Identifier* is the audience
Auth0 stamps into access tokens — use your plugin's canonical URL. Then:

```bash
OAUTH_ISSUER=https://YOUR_TENANT.auth0.com/
OAUTH_AUDIENCE=https://my-plugin.example.com   # the API Identifier, verbatim
```

Notes:

- The issuer **ends with a slash** — Auth0's `iss` claim includes it, and the value must match exactly.
- Auth0 signs with RS256 by default; discovery provides the JWKS. Nothing else to set.
- For interactive MCP clients, enable **Dynamic Application Registration** (tenant settings) so
  clients can register themselves after discovering the server through the RFC 9728 metadata.

### Microsoft Entra ID

Register an application (Entra admin center → App registrations), then **Expose an API** to get an
*Application ID URI* (`api://<app-client-id>`) and add at least one scope. Then:

```bash
OAUTH_ISSUER=https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0
OAUTH_AUDIENCE=api://YOUR_APP_CLIENT_ID        # the Application ID URI
OAUTH_SCOPE=api://YOUR_APP_CLIENT_ID/.default  # or a named scope you exposed
```

Notes:

- Use the **v2.0** issuer (shown above); v1.0 tokens carry a different `iss` format.
- The `aud` of v2.0 access tokens is the Application ID URI (or the bare client-id GUID,
  depending on how the client requests the scope) — set `OAUTH_AUDIENCE` to what your tokens
  actually carry.
- Entra ID does **not** support dynamic client registration: every MCP client (Claude, MCPJam, …)
  must be pre-registered as its own app registration with its redirect URIs. This makes Entra a
  poor fit for ad-hoc MCP clients; it works well for a fixed, known set of clients.

### What the OAuth server must provide

Any standards-compliant OAuth2 / OIDC server works, as long as it can:

1. **Serve OIDC discovery** at `<issuer>/.well-known/openid-configuration` with a `jwks_uri` and
   `token_endpoint` (or you set `OAUTH_JWKS_URI` / `OAUTH_TOKEN_URL` explicitly).
2. **Issue JWT access tokens** signed with `RS256` or `ES256`, with the `iss` claim matching the
   issuer and the `aud` claim matching your configured audience/resource.
3. Ideally include the standard user-info claims — `sub`, `email`, `name` /
   `preferred_username`, `picture` — which map to the `QuartalPluginContext` your tools receive.
4. For interactive MCP clients (Claude and others): support **dynamic client registration** or
   **Client ID Metadata Documents**, so the client can register itself after discovering the
   server through the plugin's RFC 9728 metadata. Without it, you must pre-register each client
   manually.

### Can these be set in `qrtl.config.ts`?

No — deliberately. `qrtl.config.ts` sets only the *mode* (`auth: "anon" | "quartal-hub" | "custom"`);
the OAuth details stay out of it because they are deployment-specific — a staging and a production
deployment of the same plugin use different issuers, resource URIs and client ids, and those
belong in each environment rather than in a file committed to the repository. Use environment
variables per deployment.

If you host the plugin app programmatically (outside the Astro integration), you can pass a typed
`OAuthOptions` object to `getAuthApp(config, oauth)` instead — it supports everything the
environment variables do, plus overrides such as `algorithms`, `additionalScopes` and a custom
`claimsToContext` mapper from JWT claims to the `QuartalPluginContext`.

## What is protected, exactly

| Surface | With `"quartal-hub"` / `"custom"` |
|---|---|
| `POST /api/<Class>/<method>` | Bearer token required. |
| `ALL /mcp`, `/mcp/<server>` | Bearer token required; unauthenticated calls get the RFC 9728 challenge. |
| `GET /.well-known/oauth-protected-resource` | Public (this is how clients find your auth server). |
| Docs site, `/widgets/*`, `/widget-assets/*`, `public/` | Public. |

Changing `auth` is picked up on dev-server restart; `qrtl.config.ts` is watched, so saving it
restarts automatically. See also the [configuration reference](/docs/reference/configuration/).
