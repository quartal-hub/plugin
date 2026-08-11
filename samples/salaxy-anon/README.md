# Salaxy anonymous testing

<div class="lead mb-3">
Provides methods from the Salaxy API that are available anonymously: Without creating a Salaxy account.
This is especially useful for learning, testing and development purposes for row types (palkkalajit), imports,
TES logic and general agent skills development.
</div>

The plugin uses the same Salaxy server (the demo version) as a real authenticated pakcage would, but with unauthenticated methods that do
not store anything in the database.

## Connect to Claude AI

To connect this service to Claude, click `Customize` in the left navi:

![Click `Customize` in the left navi](/screen-shots/mcp-add-1-customize.png)

Then in the Customize menu, click `Connectors`:

![Click `Connectors`](/screen-shots/mcp-add-2-connector.png)

Click the plus-button (+) next to `Connectors` header, then click `Add custom connector`:
![Click plus button](/screen-shots/mcp-add-3-add-connector.png)

In the opening dialog, write some descriptive name, e.g. "Salaxy Anonymous tools" and the MCP service url:
`https://mcp-anon.salaxy.com/mcp`:

![Click plus button](/screen-shots/mcp-add-4-dialog.png)

## Developer use

To develop MCP widgets (the UI for MCP tools)

- Run `deno task dev` for the server
  - Changes to server-side Deno code are applied immediately
- Run `deno task watch:vue` for the Vue UI application in watch mode
  - Run this in a separate terminal
  - If you choose not to run this, run `deno task build:vue` to build the changes in vue app to `vue/dist`.

For developing the Widgets developed Vue, we strongly recommend using [[https://www.mcpjam.com/]] either by installing it or simply running
`npx @mcpjam/inspector@latest`. Only when the widgets are ready in MCPJam, test them out in Claude.

Before commit / deployment:

- run `deno task build:vue` if there are any changes on vue side.
- run `deno task check` in the monorepo root
