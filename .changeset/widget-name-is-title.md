---
"@quartal/plugin": patch
---

A widget's `name` in `widgets.entries` of `qrtl.config.ts` is now its display title: the docs site,
`/widgets/routes.json`, the embed guide and the overview's `widgets[].title` show it. Without a
configured name the tool's title is used, as before.
