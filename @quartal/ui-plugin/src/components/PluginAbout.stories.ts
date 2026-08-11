import type { Meta, StoryObj } from "@storybook/vue3-vite";
import PluginAbout from "./PluginAbout.vue";
import { samplePlugin } from "../fixtures/samplePlugin.ts";

const meta: Meta<typeof PluginAbout> = {
  component: PluginAbout,
  title: "Plugin/PluginAbout",
};

export default meta;
type Story = StoryObj<typeof PluginAbout>;

export const Default: Story = {
  args: {
    plugin: samplePlugin,
    mcpUrl: "http://localhost:8000/mcp",
    readmeHtml: "<h2>Demo README</h2><p>Plugin documentation rendered from README.md.</p>",
  },
};

export const NoReadme: Story = {
  args: {
    plugin: samplePlugin,
    mcpUrl: "http://localhost:8000/mcp",
  },
};
