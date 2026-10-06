---
"@quartal/plugin": minor
"@quartal/plugin-vue": minor
---

Widgets can call the plugin's own tools: `WidgetBridge.callTool(name, args)` in `@quartal/plugin/widget`
and `callTool` on the `useExtApps` handle return the parsed tool result (and reject with the tool's error
message), so a widget can drive `@visibility app` tools — selecting an item, paging — without the model.
