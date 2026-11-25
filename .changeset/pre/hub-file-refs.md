---
"@quartal/plugin": minor
---

Quartal Files references in `@quartal/plugin/hub`: `HubFileRef` (`qrtl://<owner>/<drive>/<path>[?version=<id>]`, where the owner `~` is the company the caller's token is for — resolved by Quartal Files), `parseHubFileRef`, `formatHubFileRef` and `isHubFileRef`. `HubFiles.open(ref, { accept })` reads the referenced file with the caller's token, and `HubFiles.refOf(entry)` gives a version-pinned reference (`~` by default, the explicit owner on request).
