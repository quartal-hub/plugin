---
"@quartal/plugin": patch
"@quartal/plugin-docs-web": patch
---

Logging out of the docs UI now lets you log in as a different user. `GET /oauth/login` accepts
`?prompt=login` and forwards the standard OIDC `prompt=login` parameter to the authorization
endpoint, forcing the IAM login screen even when an SSO session is still alive. The docs UI sets
a session flag on Log out and sends the parameter on the next Log in, so a first login still gets
silent SSO. The quartal-hub issuer also moves to `https://test-iam.salaxy.com/auth/realms/salaxy`
while the new IAM environment is being set up.
