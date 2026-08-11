import type { Meta, StoryObj } from "@storybook/vue3-vite";
import McpToolTester from "./McpToolTester.vue";

const meta: Meta<typeof McpToolTester> = {
  component: McpToolTester,
  title: "Plugin/McpToolTester",
  args: {
    serverUrl: "https://anon.salaxy.com/mcp",
    title: "MCP Tool Tester",
  },
  argTypes: {
    serverUrl: { control: "text" },
    title: { control: "text" },
    initialTool: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof McpToolTester>;

/**
 * Live tester against https://anon.salaxy.com/mcp (Calculator + Employment — 5 tools, 3 with widgets).
 * Pick a tool, edit the arguments (generated form or raw JSON), Execute, then preview the widget for
 * `simpleSalary`, `getCompanies`, and `getEmployees`.
 */
export const SalaxyAnon: Story = {};

/** Preselects the `simpleSalary` calculator tool, which renders a salary-slip widget. */
export const SimpleSalary: Story = {
  args: {
    initialTool: "simpleSalary",
  },
};
