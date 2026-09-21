---
title: "HTTP endpoints"
description: "Every endpoint a running Quartal Plugin serves: metadata, MCP, REST API, skills, agents, widgets and docs."
section: reference
order: 3
---

A running Quartal Plugin is a single web server. This page lists every endpoint it serves.
All endpoints allow cross-origin requests (CORS `*`).

## The Agent Plugins package

The plugin's identity endpoints mirror the [Agent Plugins 1.0](https://agent-plugins.org)
package: what you download at `/plugin.zip` is exactly what the individual URLs serve.

| Endpoint | Returns |
|---|---|
| `GET /plugin.json` | The [Agent Plugins 1.0 manifest](https://agent-plugins.org/specification): name, version, description, author, license, keywords. Quartal-specific links (the OpenAPI document, the overview, the package) live under `extensions["com.quartal.plugin"]`. |
| `GET /mcp.json` | The standard MCP server configuration: every MCP server of the plugin as `streamable-http` entries — the plugin's own hosted servers on this origin, plus any declared external servers at their original URLs. |
| `GET /plugin.zip` | The whole installable Agent Plugin as a zip: both manifests (`plugin.json` and Claude's `.claude-plugin/plugin.json`), both MCP configs (`mcp.json` and `.mcp.json`), the skills, the agents, the README and the Quartal overview. |
| `GET /com.quartal.plugin/contents.json` | The rich Quartal overview: identity, style, and catalogs of tools, tool groups, skills, agents, widgets, prompts and MCP servers. This is what the built-in docs site renders. |

## Other metadata

| Endpoint | Returns |
|---|---|
| `GET /mcp-server.json` | MCP server info (name, version, title, website, icons) plus the declared MCP capabilities. |
| `GET /open-api.json` | The OpenAPI 3.0 document for the REST API. |
| `GET /types.json` | A flat index of the TypeScript types used by the tools. |
| `GET /readme.md` | The plugin's README as plain text. |
| `GET /icons/:index` | Plugin icons (cached one day). `GET /favicon.ico` redirects to `/icons/0`. |

## MCP

| Endpoint | Returns |
|---|---|
| `ALL /mcp` | The main MCP server over streamable HTTP. Capabilities: `tools` always; `prompts` when the plugin defines prompts; `resources` when the plugin has widgets (each widget is a `ui://widgets/<toolId>.html` resource). |
| `ALL /mcp/<server>` | Additional named MCP servers, when the plugin defines a `mcp.servers` map in `qrtl.config.ts`. Each serves its own subset of tool classes; widgets follow their tools, prompts stay on the main server. |
| `GET /mcp/tools.json` | REST mirror of the MCP `tools/list` result — the exact same JSON, readable with a plain GET. Also per server: `GET /mcp/<server>/tools.json`. |
| `GET /mcp/prompts.json` | REST mirror of `prompts/list`. |
| `GET /mcp/resources.json` | REST mirror of `resources/list`. |

## REST API

| Endpoint | Returns |
|---|---|
| `POST /api/<Class>/<method>` | Executes one tool. The request body is validated against the same schema the MCP tool uses: `200` with the result, `422` on validation errors, `500` on execution errors. Every operation is described in `open-api.json`. |

## Skills

| Endpoint | Returns |
|---|---|
| `GET /skills/catalog.json` | Catalog of all skills with download and browse URLs. |
| `GET /skills/<name>.zip` | One skill as a zip archive. `GET /skills/<name>.skill` serves the same bytes with a `.skill` filename. |
| `GET /skills/:name/SKILL.md` | The skill's `SKILL.md` as markdown. |
| `GET /skills/:name/*` | Any file inside the skill folder. |

## Agents

| Endpoint | Returns |
|---|---|
| `GET /agents/catalog.json` | Catalog of all agents with URLs for the markdown, JSON and HTML views. |
| `GET /agents/<name>.md` | The agent in Claude's markdown agent format. |
| `GET /agents/<name>.json` | The agent as resolved JSON. |

## Widgets

| Endpoint | Returns |
|---|---|
| `GET /widgets/<toolId>` | The widget page for a tool (rendered by Astro; any UI framework). The MCP server serves the same page as a `ui://` resource to MCP Apps hosts. |
| `GET /widget-assets/*` | The plugin's own assets re-served with open CORS headers, so widgets work when embedded in an agent's sandbox. |

## Authentication (auth mode only)

Plugins configured with Quartal IAM authentication additionally serve:

| Endpoint | Returns |
|---|---|
| `GET /.well-known/oauth-protected-resource` | OAuth 2.0 Protected Resource Metadata (RFC 9728), also in the path-aware form `/.well-known/oauth-protected-resource/:path`. |

With auth enabled, `/api/*` and `/mcp` require a bearer token; documentation, widgets and static
assets stay public.

## Documentation site and static files

| Endpoint | Returns |
|---|---|
| `GET /` | The built-in docs site (single-page app) with pages for tools, skills, agents, widgets, prompts and the API (Swagger and Redoc views). Served from your plugin's origin; its scripts and styles load from the published shell on plugin.quartal.com (override with the `QRTL_DOCS_WEB_URL` env var). |
| `GET /mcp.html`, `/swagger.html`, `/docs.html`, `/skills.html`, `/agents.html` | Convenience redirects into the docs site. |
| `GET /*` | Anything else falls through to the plugin's `public/` folder. |

## Your own landing page

Create `src/pages/index.astro` (or `index.md`, `.mdx`, `.html`) and it replaces the built-in docs
site at `/` — Astro renders your page, and the `.html` redirects above are released with it. All
machine endpoints (`/plugin.json`, `/mcp`, `/api/*`, OAuth, skills and agents) keep working
unchanged, so the plugin stays fully functional. The page is detected when the server starts;
restart `astro dev` after adding or removing it.

Want your own branding *and* the docs UI? Mount it on your page from
[`@quartal/plugin-docs-web`](https://www.npmjs.com/package/@quartal/plugin-docs-web) — the
package README has a complete `index.astro` example:

```astro
<div id="docs"></div>
<script>
  import "@quartal/plugin-docs-web/style.css";
  import { mountPluginDocs } from "@quartal/plugin-docs-web";
  mountPluginDocs(document.getElementById("docs")!);
</script>
```
