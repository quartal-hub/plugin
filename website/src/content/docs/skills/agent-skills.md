---
title: "Agent Skills"
description: "Ship the know-how next to the tools: markdown skills that guide agents through your business logic."
section: creating
order: 3
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

- Skills are served over MCP with the
  [Skills extension](https://modelcontextprotocol.io/extensions/skills/overview)
  (`io.modelcontextprotocol/skills`): an agent connected to your plugin's `/mcp` endpoint sees the
  skills next to the tools and loads one only when it needs it. Because the content comes from your
  plugin, skills **update automatically** when you deploy, unlike copies installed by hand.
- Each skill is the resource `skill://<name>/SKILL.md`, and its other files are
  `skill://<name>/<path>`. The skill list carries a SHA-256 digest of every file, so clients can
  verify what they load.
- `GET /mcp/skills.json` mirrors the MCP `skills/list` result, and every file is also served over
  plain HTTP at `/skills/<name>/<path>` (plus `/skills/<name>.zip` for the whole skill).
- Your plugin's docs site (at `/`) lists the skills with install commands for tools that support
  them.
- Skills are also packaged into the plugin's [Agent Plugins](https://agent-plugins.org) package
  (`/plugin.zip`), so clients that read the package get all your skills (and their updates) by
  connecting to one plugin.

## Rules the skill list enforces

- The folder name must equal the `name` in the frontmatter (lowercase letters, digits and single
  hyphens), and the frontmatter needs a `description`.
- A skill has at most 512 files and 16 MiB in total.
- Symbolic links are not allowed inside a skill.

A skill that breaks a rule is left out of the list, and the reason is printed in the dev server log.

## What belongs in a skill

- How and when to use your tools together (the "playbook").
- Domain rules and regulatory requirements.
- Examples of good inputs and outputs.

Keep confidential data **out** of skills — skills, agents, and documentation are served without
authentication. Anything confidential belongs inside [tools](/docs/tools/creating-tools), where
authentication applies.
