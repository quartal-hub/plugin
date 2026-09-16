# @quartal/plugin

## 0.8.0

### Minor Changes

- 8b460f9: Docs-site login: authenticated plugins get a **Log in** button in the docs top bar, running the same OAuth flow MCP clients use (authorization code + PKCE with a CIMD client). The plugin serves its own client metadata document at `/.well-known/oauth/client-metadata.json`; `/oauth/login` starts the flow and `/oauth/callback` exchanges the code server-side, so no authorization-server CORS is needed. On localhost the shared metadata document on plugin.quartal.com is the client. The token is injected into Swagger UI *Try it out* requests; the Swagger security scheme is now plain HTTP bearer (the OAuth2 password flow and the `swagger-test-client` default are removed). `OAUTH_CLIENT_ID` now names a pre-registered public client for the docs login in `custom` mode (Auth0 / Entra ID, which lack CIMD).
- 8b460f9: Auth modes reworked: the authenticated mode is now `auth: "quartal-hub"`. It is zero-config — fixed Quartal Hub test-environment scope (`quartal-hub-test`), audience (`https://hub.test.qrtl.com`) and issuer, with only `OAUTH_ISSUER` overridable; the RFC 9728 `resource` derives from each request's origin so localhost and deployed instances need no configuration. A new `auth: "custom"` mode connects to any OAuth2 / OIDC server (Auth0, Microsoft Entra ID, …) via the `OAUTH_*` environment variables; `OAUTH_ISSUER` is required there. The `resolveOAuthOptions` / `oauthAuthMiddleware` second parameter is now the auth mode instead of a plugin name, and per-plugin-name scope/resource derivation is removed.

### Patch Changes

- 9422615: Docs site: hide Swagger UI's Authorize button and per-operation lock icons for authenticated plugins. The docs-site top-bar login now provides the bearer token (injected into Try-it-out requests), so Swagger's own auth controls were redundant and confusing.

## 0.7.0

### Minor Changes

- aed3d80: Align plugin outputs with the Agent Plugins 1.0 standard: `GET /plugin.json` serves the standard
  manifest (the Quartal overview moved to `GET /com.quartal.plugin/contents.json`), `GET /mcp.json`
  serves the standard `mcpServers` config, and `GET /plugin.zip` serves the whole installable
  package (dual Claude manifests, skills, agents, README, Quartal extension). MCP list results are
  also mirrored as REST (`GET /mcp/tools.json`, `/mcp/prompts.json`), and a plugin can declare
  multiple named MCP servers — hosted at `/mcp/<name>` or external — via the `mcp.servers` section
  of `qrtl.config`. `@quartal/plugin-core` carries the new manifest and multi-server model types.
- aed3d80: `qrtl.config.ts` is now the single source of plugin configuration. The `qrtlPlugin()` Astro
  integration reads the auth mode from `qrtl.config` — the `qrtlPlugin({ auth })` option is
  deprecated (it still wins when passed, with a warning) — fails the build when a config file
  exists but cannot be loaded instead of silently falling back to anonymous, and watches the config
  file so edits restart the dev server. Every `package.json` identity field (`version`, `license`,
  `homepage`, `author`, `repository`, `keywords`, in addition to the existing `name` and
  `description`) can now also be set in `qrtl.config`, which takes precedence; `package.json` is
  the fallback.

### Patch Changes

- Updated dependencies [aed3d80]
  - @quartal/plugin-core@0.7.0

## 0.6.1

### Patch Changes

- 97dc6c5: Baseline release of every published package to verify the upgraded release pipeline
  (changesets/action v2) pushes git tags and creates GitHub Releases on publish.
- Updated dependencies [97dc6c5]
  - @quartal/plugin-core@0.6.1

## 0.6.0

### Minor Changes

- e4c8a90: Add the `@visibility` JSDoc tag for tools (MCP Apps `_meta.ui.visibility`): `model` and/or `app`
  scopes, advertised in `tools/list` so hosts can hide widget-only helper tools from the model.
  New `McpToolVisibility` type and optional `visibility` on `McpToolDescriptor` / `CodeFunction`.

### Patch Changes

- Updated dependencies [e4c8a90]
  - @quartal/plugin-core@0.6.0

## 0.5.2

### Patch Changes

- 844f6df: Readme images updated

## 0.5.1

### Patch Changes

- 3922e86: Remove leftovers from the project's Deno/JSR era.
  
  `@quartal/plugin-core` drops `deno.jsonc` and is now a plain pnpm TypeScript package. Its README
  documents that the package has, and must keep, no runtime dependencies: it sits at the bottom of the
  dependency graph for every other `@quartal` package and is consumed from server, browser, and
  bundler contexts alike.
  
  Documentation and comments across the other packages no longer describe the Deno-era toolchain.
  Published READMEs are affected, hence the version bumps; there are no code changes.
- 3922e86: Regenerate the package README from the docs vault: adds the Prompts artifact type and Agents to the
  artifact lists, links the plugin template repository, and replaces the header image with a cropped
  version. Removes a duplicated Getting Started section.
- Updated dependencies [3922e86]
  - @quartal/plugin-core@0.5.1
