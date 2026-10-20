import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { createPluginClient, type PluginInfo } from "@quartal/plugin-core";
import PluginToolsIndex from "./PluginToolsIndex.vue";
import { samplePlugin } from "../fixtures/samplePlugin.ts";

const meta: Meta<typeof PluginToolsIndex> = {
  component: PluginToolsIndex,
  title: "Plugin/PluginToolsIndex",
};

export default meta;
type Story = StoryObj<typeof PluginToolsIndex>;

export const Default: Story = {
  args: {
    plugin: samplePlugin,
  },
};

export const NoTools: Story = {
  args: {
    plugin: { ...samplePlugin, tools: [], toolGroups: [] },
  },
};

/** Live data from https://anon.salaxy.com/. */
export const SalaxyAnon: Story = {
  render: () => ({
    components: { PluginToolsIndex },
    data: () => ({
      plugin: null as PluginInfo | null,
      error: null as string | null,
      loading: true,
    }),
    async mounted() {
      try {
        this.plugin = await createPluginClient({ baseUrl: "https://anon.salaxy.com" }).getPlugin();
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e);
      } finally {
        this.loading = false;
      }
    },
    template: `
      <p v-if="loading" class="text-muted">Loading…</p>
      <p v-else-if="error" class="text-danger">{{ error }}</p>
      <PluginToolsIndex v-else-if="plugin" :plugin="plugin" />
    `,
  }),
};
