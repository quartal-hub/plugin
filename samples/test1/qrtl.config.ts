import { defineQrtlConfig } from "@quartal/plugin";

export default defineQrtlConfig({
  title: "Test 1",
  description: "First test for Quartal Plugins.",
  style: {
    logo: "https://cdn.quartal.com/img/logo/quartal-logo-vertical.png",
    icons: [{ src: "https://cdn.quartal.com/img/logo/quartal-logo-q.png", mimeType: "image/png", sizes: ["128x128"] }],
  },
  auth: "anon",
  // Multi-server MCP example: two hosted servers plus a declared external server.
  mcp: {
    servers: {
      main: {
        tools: ["HelloWorld", "Calculator", "ErrorTester"],
        description: "The general demo tools (greetings, calculator, error testing).",
      },
      types: {
        tools: ["TypesTester"],
        description: "Type-system stress tests: every schema shape the codegen supports.",
      },
      "astro-docs": {
        external: { url: "https://mcp.docs.astro.build/mcp" },
        description: "Astro documentation search — an external MCP server declared by this plugin.",
      },
    },
  },
  deploy: { org: "quartal", app: "test1" },
});
