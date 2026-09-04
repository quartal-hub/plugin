---
title: "Getting started"
description: "Create, run and test your first Quartal Plugin in a few minutes."
section: start
order: 1
---

## Requirements

- Node.js 20+
- We recommend [MCPJam](https://www.mcpjam.com/) for local testing, especially for widgets.

## Create a plugin

With pnpm:

```bash
pnpm create @quartal/plugin
```

With npm:

```bash
npm create @quartal/plugin
```

Alternatively, fork the template repository at
[quartal-hub/plugin-template](https://github.com/quartal-hub/plugin-template).

## Run it

```bash
pnpm install
pnpm dev
```

Your plugin is an [Astro](https://astro.build) project running on `http://localhost:4321`, serving:

| URL | What |
|---|---|
| `/` | Documentation site for your plugin (tools, widgets, skills, API testers) |
| `/mcp` | The MCP server — connect any MCP client here |
| `/api/<Class>/<method>` | The generated OpenAPI / REST actions |
| `/plugin.json` | The plugin manifest |
| `/widgets/<toolId>` | Your widget pages |
| `/skills/catalog.json` | The Agent Skills catalog |

## Make it yours

1. Add a tool: create a class in `src/tools/` and export it from `src/tools/mod.ts` —
   see [Creating tools](/docs/tools/creating-tools).
2. Add a widget for a tool: create a page in `src/pages/widgets/` —
   see [MCP Apps widgets](/docs/widgets/mcp-apps-widgets).
3. Add a skill: create a folder with a `SKILL.md` under `skills/` —
   see [Agent Skills](/docs/skills/agent-skills).

## Test with an MCP client

Point [MCPJam](https://www.mcpjam.com/) (or Claude, or any MCP client) at
`http://localhost:4321/mcp` and try your tools live.

## Deploy

Build and run like any server-output Astro site — then deploy to
[any modern hosting platform](https://docs.astro.build/en/guides/deploy/):

```bash
pnpm build
node ./dist/server/entry.mjs
```
