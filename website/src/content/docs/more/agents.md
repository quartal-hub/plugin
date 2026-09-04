---
title: "Agents"
description: "Ship agent definitions — interactive or autonomous — as markdown or JSON files."
section: more
order: 2
---

An **agent** packages a persona and instructions for a specific job — for example an interactive
agent that creates invoices from text or voice, or an autonomous agent that monitors unpaid
invoices and sends reports. The format follows
[Claude plugin agents](https://code.claude.com/docs/en/plugins-reference#agents); support for other
platforms is planned.

## Create an agent

Add one file per agent — markdown with frontmatter, or JSON — to the `agents/` folder:

```text
agents/
  invoice-creator.md     # frontmatter (name, description, model, tools, …) + instructions
  overdue-monitor.json   # the same fields as JSON
```

The markdown body is the agent's system prompt; the frontmatter declares its name, description
and the tools it may use (which can point at your plugin's own MCP tools).

## How agents are served

- The agent catalog is published at `/agents/catalog.json`, with each definition served from your
  plugin.
- Agents are included in the plugin's [Claude plugin](https://code.claude.com/docs/en/plugins)
  packaging, so Claude users get them — with automatic updates — by connecting to your plugin.
- For platforms without agent support you can copy the definition text into the platform's own
  agent/prompt configuration.

Like skills, agent definitions are served without authentication — keep confidential data inside
[tools](/docs/tools/creating-tools).
