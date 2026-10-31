# @quartal/plugin-embed

## 1.0.0

### Minor Changes

- c490195: Embed a plugin's widgets in any web page. The new `@quartal/plugin-embed` package is a dependency-free
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
  
  `contents.json` records the `@quartal/plugin` version a plugin was built with
  (`PluginInfo.generator: { name, version }`), and the docs front page shows it under the plugin's name as
  "Created with @quartal/plugin, version <version>", linking to plugin.quartal.com and the version's npm
  page.

### Patch Changes

- 1da3ea3: Dependencies moved to their current releases. The MCP stack is now v2 throughout: the widget
  runtime uses `@modelcontextprotocol/ext-apps` 2.x, the docs site's tool tester connects with
  `@modelcontextprotocol/client`, and the v1 `@modelcontextprotocol/sdk` is no longer a dependency
  of any package. `@quartal/plugin` lists `@modelcontextprotocol/client` and `zod` as dependencies
  because ext-apps needs them at runtime. Toolchain: TypeScript 6.0, Vite 8, Vitest 5, Astro 7.4
  (which requires Node.js 22.23.4 or later), Vue Router 5, vue-tsc 3, Storybook 10.6. The
  `@quartal/create-plugin` CLI declares the same Node.js requirement.
  
  `@quartal/ui-plugin` ships a single bundled `dist/index.d.ts` again. Its types import `PluginInfo`,
  `CodeType` and the other plugin metadata types from `@quartal/plugin-core`, which is now a dependency
  of the package; the previous build wrote those imports as relative paths into the workspace sources,
  which do not exist in the published package.

## 1.0.0-beta.1

### Minor Changes

- c490195: Embed a plugin's widgets in any web page. The new `@quartal/plugin-embed` package is a dependency-free
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
  
  `contents.json` records the `@quartal/plugin` version a plugin was built with
  (`PluginInfo.generator: { name, version }`), and the docs front page shows it under the plugin's name as
  "Created with @quartal/plugin, version <version>", linking to plugin.quartal.com and the version's npm
  page.
