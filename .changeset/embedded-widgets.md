---
"@quartal/plugin-embed": minor
"@quartal/plugin": minor
"@quartal/plugin-core": minor
"@quartal/ui-plugin": minor
"@quartal/create-plugin": patch
---

Embed a plugin's widgets in any web page. The new `@quartal/plugin-embed` package is a dependency-free
MCP Apps host (`createWidgetHost`), a REST client for a plugin's tools (`connectPlugin`, with
`callTool` and `mountWidget`), the `<qrtl-widget>` custom element (`@quartal/plugin-embed/element`),
React bindings (`PluginWidget`, `usePluginTool` from `@quartal/plugin-embed/react`) and Vue bindings
(`@quartal/plugin-embed/vue`). A widget's own tool calls reach the page first (`onToolCall` /
`toolcall` event), which can answer them or let them run over REST with the page's bearer token.

Every plugin now serves `GET /widgets.js` (the `<qrtl-widget>` module with the plugin's route table
built in, about 5 KB gzipped), `GET /widgets/routes.json` (each tool's REST route and parameter
placement, keyed by MCP tool id, and each widget's page), `GET /widgets/embed.md` and
`GET /widgets/<toolId>/embed.md` (copy-paste snippets, the input type and a prompt for coding agents).
`PluginToolExposure` gains `restPathParams` and `restInputIn`.

`@quartal/ui-plugin`: the MCP tool tester previews widgets with the `@quartal/plugin-embed` host
(`mountMcpWidget` replaces `mountWidget`; `WidgetHostHandle.host` replaces `bridge`), so the ext-apps
`AppBridge` is no longer bundled. The docs site's Widgets page shows a live preview of each widget and
its embedding snippets. `@quartal/create-plugin` scaffolds the new `@quartal/*` versions.

A widget's height can be limited: `maxHeight` on `createWidgetHost`, `mountWidget` (plus
`setMaxHeight`), the React and Vue `PluginWidget`, and the `max-height` attribute of `<qrtl-widget>`.
The iframe follows the content up to the limit, and the widget gets it as
`containerDimensions.maxHeight`. The docs preview limits widgets to 600 px, and its Embed tab shows
the snippets in the read-only code viewer.
