Salaxy Authenticated example
============================

Example of a Salaxy-authenticated plugin with Vercel deployment.

The sample demonstrates:

- Authentication to Salaxy IAM (https://test-iam.salaxy.com/auth/realms/salaxy)
  - Configured with the `auth` object in `qrtl.config.ts` (`mode: "quartal-hub"` + the Salaxy realm as issuer;
    `OAUTH_*` environment variables still override per deployment)
  - Account login in https://test-iam.salaxy.com/auth/realms/salaxy/account
- Company selection and Salaxy SSO (`src/lib/salaxyContext.ts`), all through the Quartal IAM API
  (https://iam-api.quartal.deno.net — override with `QUARTAL_IAM_API_URL`):
  - `POST /api/Companies/mine` lists the companies the signed-in user may act for (own memberships and
    advisor customers); companies without a Salaxy account are left out
  - The user's choice is stored as a per-user IAM secret (`POST /api/Secrets/set`, name
    `plugin.salaxy-auth.company`), so it survives across requests and server instances. A user with a single
    company needs no selection
  - `POST /api/SalaxySso/createToken` exchanges the verified Quartal access token for a Salaxy token for the
    selected company; the Salaxy API root is `SALAXY_API_URL` (default https://test-api.salaxy.com)
  - Requires the token to carry the IAM API audience: the IAM realm must allow this plugin's
    client to request the `iam-api` scope, and the scope must then be enabled in `qrtl.config.ts`
    (see the commented `scope` line — requesting it before the realm allows it breaks login
    with `invalid_scope`)
- Company tools (`src/tools/CompanyTools.ts`): `getCompanies` (list + selection), `selectCompany`, and the
  app-only `getCurrentUser` used by the widgets. Every Salaxy tool works within the selected company and
  tells the agent to select one when the user has several and none is chosen
- Salaxy tools (`src/tools/SalaxyTools.ts`): session and company info, salary calculations,
  employment relations
- Vue widgets (`src/pages/widgets/` + `src/components/`):
  - `getCompanies` — a company picker; choosing a company calls `selectCompany` from the widget
  - `getSession` — the current Salaxy session
  - Every widget shows the signed-in user and the selected company at the top (`CurrentUser.vue`, which calls
    `getCurrentUser` through `useExtApps().callTool`)
