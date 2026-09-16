---
"@quartal/plugin": patch
---

Docs site: hide Swagger UI's Authorize button and per-operation lock icons for authenticated plugins. The docs-site top-bar login now provides the bearer token (injected into Try-it-out requests), so Swagger's own auth controls were redundant and confusing.
