---
title: "Agent Skills"
description: "Ship the know-how next to the tools: markdown skills that guide agents through your business logic."
section: skills
order: 1
---

**Agent Skills** are folders of markdown (plus optional assets and scripts) that teach an AI agent
*how* to use your tools and your business domain — regulatory requirements, workflows, when to ask
the user, and so on. The format is the [Agent Skills](https://agentskills.io/) standard supported
by most advanced AI tools.

## Create a skill

Add a folder under `skills/` with a `SKILL.md`:

```text
skills/
  invoice-basics/
    SKILL.md          # the skill instructions (with YAML frontmatter)
    assets/           # optional supporting files
    scripts/          # optional helper scripts
```

`SKILL.md` starts with frontmatter (`name`, `description`) followed by the instructions — the
description tells the agent *when* to load the skill, the body tells it *what to do*.

## How skills are served

- The skill catalog is published at `/skills/catalog.json`, and each skill's content is served
  from your plugin — so skills **update automatically** when you deploy, unlike copies installed
  by hand.
- Your plugin's docs site (at `/`) lists the skills with install commands for tools that support
  them.
- Because many vibe-coding tools don't support Agent Skills natively, the plugin also exposes an
  MCP tool endpoint for browsing skills content.
- Skills are also packaged into the plugin's [Claude plugin](https://code.claude.com/docs/en/plugins)
  distribution, so Claude users get all your skills (and their updates) by connecting to one
  plugin.

## What belongs in a skill

- How and when to use your tools together (the "playbook").
- Domain rules and regulatory requirements.
- Examples of good inputs and outputs.

Keep confidential data **out** of skills — skills, agents, and documentation are served without
authentication. Anything confidential belongs inside [tools](/docs/tools/creating-tools), where
authentication applies.
