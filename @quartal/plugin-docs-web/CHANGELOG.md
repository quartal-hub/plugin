# @quartal/plugin-docs-web

## 0.5.1

### Patch Changes

- 2593469: A failed docs-site login now surfaces the actual OAuth error: the full message (e.g. Keycloak's
  `Invalid scopes: …`) is logged to the browser console and shown in a dismissible alert banner
  under the top bar, instead of a bare "Login failed" label with the detail hidden in a tooltip.
- d6cb364: Logging out of the docs UI now lets you log in as a different user. `GET /oauth/login` accepts
  `?prompt=login` and forwards the standard OIDC `prompt=login` parameter to the authorization
  endpoint, forcing the IAM login screen even when an SSO session is still alive. The docs UI sets
  a session flag on Log out and sends the parameter on the next Log in, so a first login still gets
  silent SSO. The quartal-hub issuer also moves to `https://test-iam.salaxy.com/auth/realms/salaxy`
  while the new IAM environment is being set up.
