import type { Meta, StoryObj } from "@storybook/vue3-vite";
import PluginSummary from "./PluginSummary.vue";
import { samplePlugin } from "../fixtures/samplePlugin.ts";

const meta: Meta<typeof PluginSummary> = {
  component: PluginSummary,
  title: "Plugin/PluginSummary",
};

export default meta;
type Story = StoryObj<typeof PluginSummary>;

export const Default: Story = {
  args: { plugin: samplePlugin },
};
