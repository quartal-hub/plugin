---
"@quartal/plugin-docs-web": patch
---

A failed docs-site login now surfaces the actual OAuth error: the full message (e.g. Keycloak's
`Invalid scopes: …`) is logged to the browser console and shown in a dismissible alert banner
under the top bar, instead of a bare "Login failed" label with the detail hidden in a tooltip.
