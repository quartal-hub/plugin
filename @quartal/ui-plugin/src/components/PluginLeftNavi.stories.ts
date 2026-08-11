import type { Meta, StoryObj } from "@storybook/vue3-vite";
import PluginLeftNavi from "./PluginLeftNavi.vue";
import { samplePlugin } from "../fixtures/samplePlugin.ts";

const meta: Meta<typeof PluginLeftNavi> = {
  component: PluginLeftNavi,
  title: "Plugin/PluginLeftNavi",
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof PluginLeftNavi>;

export const Default: Story = {
  args: {
    plugin: samplePlugin,
  },
};

export const EmptySections: Story = {
  args: {
    plugin: {
      ...samplePlugin,
      tools: [],
      toolGroups: [],
      skills: [],
      widgets: [],
    },
  },
};
