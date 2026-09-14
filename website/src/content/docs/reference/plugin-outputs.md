---
title: "Plugin project & generated files"
description: "What a Quartal Plugin project contains, and every file the build generates from your code."
section: reference
order: 1
---

A Quartal Plugin is an [Astro](https://astro.build) project with the `qrtlPlugin()` integration.
You write TypeScript classes, skills and widget pages; the build analyzes them and generates all
tool metadata for you. This page lists exactly what you author and exactly what gets generated.

## Files you author

| Path | Format | Purpose |
|---|---|---|
| `qrtl.config.ts` | TypeScript (`defineQrtlConfig({...})`) | The plugin configuration: identity, title, style/skin, auth mode, MCP servers, widget settings. See [Configuration](/docs/reference/configuration). |
| `package.json` | JSON | The npm manifest. Identity fields (`name`, `version`, `description`, `license`, `repository`, …) act as fallbacks for `qrtl.config.ts`. |
| `astro.config.mjs` | JavaScript | Astro setup: `integrations: [qrtlPlugin()]`, `output: "server"`, an adapter. |
| `src/tools/*.ts` + `src/tools/mod.ts` | TypeScript classes | Every public method of every exported class becomes one MCP tool **and** one REST action. See [Creating tools](/docs/tools/creating-tools). |
| `src/prompts/*.ts` + `src/prompts/mod.ts` | TypeScript classes | Optional. Each method becomes an MCP prompt. See [Prompts](/docs/more/prompts). |
| `src/pages/widgets/<toolId>.astro` | Astro page (any UI framework inside) | Optional. An interactive widget shown by the agent when the tool with that id is called. See [Widgets](/docs/widgets/mcp-apps-widgets). |
| `skills/<name>/SKILL.md` | Markdown + YAML frontmatter ([Agent Skills](https://agentskills.io) standard) | Optional. Skills can include extra folders such as `assets/`, `scripts/` and `references/`. |
| `agents/<name>.md` or `.json` | Claude agent format | Optional. Ready-made agent definitions that use the plugin's tools and skills. |
| `public/**` | Any static files | Served at the site root. |
| `README.md` | Markdown | Served at `/readme.md` and shown in the built-in docs site. |

## Generated files

When the plugin builds (or the dev server starts), the framework reads your TypeScript with the
TypeScript compiler and writes its metadata to `src/qrtl-plugin/`. The folder is a build artifact:
it is gitignored and regenerated on every change to `src/tools`, `src/prompts`, `skills` or
`agents`.

| File | Contents |
|---|---|
| `contents.json` | The plugin overview: name, title, version, style, plus catalogs of tools, tool groups, skills, agents, widgets, prompts and MCP servers. Served at runtime as [`GET /com.quartal.plugin/contents.json`](/docs/reference/http-endpoints). |
| `mcp-tools.json` | One descriptor per tool: id, source class/method, description, JSON Schema for input and output, and visibility. This drives both the MCP server and the REST routes. |
| `mcp-prompts.json` | One descriptor per MCP prompt: id, description and arguments. |
| `open-api.json` | A complete OpenAPI 3.0 document for the REST API — one `POST /api/<Class>/<method>` operation per tool, with your types as named component schemas and one tag per class. |
| `tools.json` | The full source-code analysis (files, classes, types) that the metadata above is derived from. Used by the built-in docs site to show code-level detail. |
| `types.json` | A flat index of all types referenced by the tools. |
| `tools.registry.ts`, `prompts.registry.ts` | Static import maps that bind the metadata back to your classes at runtime, so the plugin works after bundling. |

Everything in the table is derived from the same source: your classes and their JSDoc comments.
The [schema generation rules](/docs/tools/creating-tools#how-a-method-becomes-a-tool) describe how
types and tags map to schema fields.

## Where the outputs are used

- The **MCP server(s)** at `/mcp` (and `/mcp/<name>`) serve the tools, prompts and widget
  resources.
- The **REST API** at `/api/...` serves the same tools as HTTP actions, documented by
  `open-api.json`.
- The **Agent Plugins package** — the standard `plugin.json` + `mcp.json` manifests served at the
  origin root, downloadable as one installable zip at `/plugin.zip`.
- The **built-in docs site** at `/` renders the overview, tools, skills, agents, widgets and
  prompts for a human reader.

The complete list of runtime endpoints is on the
[HTTP endpoints](/docs/reference/http-endpoints) page.
