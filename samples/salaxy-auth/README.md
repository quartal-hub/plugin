Salaxy Authenticated example
============================

Example of a Salaxy-authenticated plugin with Vercel deployment.

The sample demonstrates:

- Authentication to Salaxy IAM (https://test-iam.salaxy.com/auth/realms/salaxy)
  - Configured with the `auth` object in `qrtl.config.ts` (`mode: "quartal-hub"` + the Salaxy realm as issuer;
    `OAUTH_*` environment variables still override per deployment)
  - Account login in https://test-iam.salaxy.com/auth/realms/salaxy/account
- Salaxy SSO (`src/lib/salaxyContext.ts`):
  - Exchanges the verified Quartal access token for a Salaxy SSO token via the Quartal IAM API
    (`POST /api/SalaxySso/getToken` on https://iam-api.quartal.deno.net — override with `QUARTAL_IAM_API_URL`)
  - Requires the Salaxy certificate to be stored in the Quartal account console
    (Salaxy: Settings → Authorisations → Digital certificate)
  - Requires the token to carry the IAM API audience: the IAM realm must allow this plugin's
    client to request the `iam-api` scope, and the scope must then be enabled in `qrtl.config.ts`
    (see the commented `scope` line — requesting it before the realm allows it breaks login
    with `invalid_scope`)
  - Builds an authenticated `@salaxy/core` `AjaxFetch` client against the API root the exchange returns
- Salaxy tools (`src/tools/SalaxyTools.ts`): session and company info, salary calculations,
  employment relations
- A Vue widget (`src/pages/widgets/getSession.astro` + `src/components/GetSession.vue`) that shows
  the current Salaxy session for the `getSession` tool in MCP Apps hosts
