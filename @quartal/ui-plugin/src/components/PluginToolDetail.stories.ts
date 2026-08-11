import type { Meta, StoryObj } from "@storybook/vue3-vite";
import PluginToolDetail from "./PluginToolDetail.vue";
import { samplePlugin, sampleTypes } from "../fixtures/samplePlugin.ts";

const meta: Meta<typeof PluginToolDetail> = {
  component: PluginToolDetail,
  title: "Plugin/PluginToolDetail",
};

export default meta;
type Story = StoryObj<typeof PluginToolDetail>;

export const Add: Story = {
  args: {
    tool: samplePlugin.tools[0],
    types: sampleTypes,
  },
};
