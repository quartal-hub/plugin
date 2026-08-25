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

To run the package locally

```sh
cd samples/salaxy-anon
pnpm dev
```

For developing the Widgets developed Vue, we strongly recommend using [[https://www.mcpjam.com/]] either by installing it or simply running
`npx @mcpjam/inspector@latest`. Only when the widgets are ready in MCPJam, test them out in Claude.
