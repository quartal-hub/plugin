import type { PluginInfo } from "@quartal/plugin-core";

export const samplePlugin: PluginInfo = {
  name: "@samples/demo",
  title: "Demo Plugin",
  description: "Example Quartal Plugin for agent configuration UI.",
  version: "1.0.0",
  homepage: "https://example.com",
  style: { logo: "https://cdn.quartal.com/img/logo/quartal-logo-vertical.png", icons: [] },
  hasReadme: true,
  tools: [
    {
      name: "add",
      className: "Calculator",
      fileName: "Calculator",
      summary: "Add two numbers",
      description: "Add two numbers together.",
      parameters: [{ name: "input", description: "Operands.", type: "Calculator_add_Input" }],
      returns: { name: "", description: "The sum.", type: "NumberValue" },
      exposure: { mcpName: "calculator_add", restUrl: "/Calculator/add", restMethod: "post" },
      hasWidget: false,
    },
    {
      name: "multiply",
      className: "Calculator",
      fileName: "Calculator",
      description: "Multiply two numbers.",
      parameters: [{ name: "input", description: "Operands.", type: "MultiplyThese" }],
      returns: { name: "", description: "The product.", type: "NumberValue" },
      exposure: { mcpName: "calculator_multiply", restUrl: "/Calculator/multiply", restMethod: "post" },
      hasWidget: true,
    },
    {
      name: "sayHello",
      className: "HelloWorld",
      fileName: "HelloWorld",
      summary: "Say hello",
      description: "Say hello to the world.",
      parameters: [{ name: "input", description: "Greeting input.", type: "HelloWorld_sayHello_Input" }],
      returns: { name: "", description: "The greeting.", type: "StringValue" },
      exposure: { mcpName: "hello_say", restUrl: "/HelloWorld/sayHello", restMethod: "post" },
      hasWidget: false,
    },
  ],
  toolGroups: [
    {
      className: "Calculator",
      fileName: "Calculator",
      tools: [
        {
          name: "add",
          className: "Calculator",
          fileName: "Calculator",
          summary: "Add two numbers",
          description: "Add two numbers together.",
          parameters: [{ name: "input", description: "Operands.", type: "Calculator_add_Input" }],
          returns: { name: "", description: "The sum.", type: "NumberValue" },
          exposure: { mcpName: "calculator_add", restUrl: "/Calculator/add", restMethod: "post" },
          hasWidget: false,
        },
        {
          name: "multiply",
          className: "Calculator",
          fileName: "Calculator",
          description: "Multiply two numbers.",
          parameters: [{ name: "input", description: "Operands.", type: "MultiplyThese" }],
          returns: { name: "", description: "The product.", type: "NumberValue" },
          exposure: { mcpName: "calculator_multiply", restUrl: "/Calculator/multiply", restMethod: "post" },
          hasWidget: true,
        },
      ],
    },
    {
      className: "HelloWorld",
      fileName: "HelloWorld",
      tools: [
        {
          name: "sayHello",
          className: "HelloWorld",
          fileName: "HelloWorld",
          summary: "Say hello",
          description: "Say hello to the world.",
          parameters: [{ name: "input", description: "Greeting input.", type: "HelloWorld_sayHello_Input" }],
          returns: { name: "", description: "The greeting.", type: "StringValue" },
          exposure: { mcpName: "hello_say", restUrl: "/HelloWorld/sayHello", restMethod: "post" },
          hasWidget: false,
        },
      ],
    },
  ],
  skills: [
    { name: "coin-flipper", description: "Flip a coin.", fileCount: 1 },
    { name: "letterhead-stamp", description: "Stamp letterhead.", fileCount: 2 },
  ],
  agents: [
    {
      name: "hello-agent",
      description: "Greets people using the plugin's own tools.",
      model: "anthropic/claude-sonnet-5",
      color: { value: "purple", claude: "purple", bootstrap: "secondary", css: "#6f42c1" },
      toolCount: 2,
      skills: ["coin-flipper"],
    },
  ],
  widgets: [
    {
      name: "CalculatorWidget",
      title: "calculator_multiply",
      description: "Widget for multiply.",
      toolId: "calculator_multiply",
      resourceUri: "ui://widgets/calculator_multiply.html",
    },
  ],
  resources: [],
  prompts: [],
  links: {
    openApi: "/open-api.json",
    types: "/types.json",
    mcpServer: "/mcp-server.json",
    skillsCatalog: "/skills/catalog.json",
    agentsCatalog: "/agents/catalog.json",
    readme: "/readme.md",
    api: "/api",
    mcp: "/mcp",
  },
};

export const sampleTypes = [
  {
    name: "Calculator_add_Input",
    description: "Input for add.",
    properties: [
      { name: "a", type: "number", description: "First operand." },
      { name: "b", type: "number", description: "Second operand." },
    ],
    extends: [],
  },
  {
    name: "NumberValue",
    description: "Numeric result wrapper.",
    properties: [{ name: "value", type: "number", description: "The number." }],
    extends: [],
  },
];
