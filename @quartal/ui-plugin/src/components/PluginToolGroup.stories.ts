import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { createPluginClient, type PluginToolGroup } from "@quartal/plugin-core";
import PluginToolGroup from "./PluginToolGroup.vue";
import { samplePlugin } from "../fixtures/samplePlugin.ts";

const meta: Meta<typeof PluginToolGroup> = {
  component: PluginToolGroup,
  title: "Plugin/PluginToolGroup",
};

export default meta;
type Story = StoryObj<typeof PluginToolGroup>;

export const Calculator: Story = {
  args: {
    group: samplePlugin.toolGroups[0],
  },
};

/** Live data from https://anon.salaxy.com/ (Calculator + Employment). */
export const SalaxyAnon: Story = {
  render: () => ({
    components: { PluginToolGroup },
    data: () => ({
      groups: [] as PluginToolGroup[],
      error: null as string | null,
      loading: true,
    }),
    async mounted() {
      try {
        const plugin = await createPluginClient({ baseUrl: "https://anon.salaxy.com" }).getPlugin();
        this.groups = plugin.toolGroups;
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e);
      } finally {
        this.loading = false;
      }
    },
    template: `
      <p v-if="loading" class="text-muted">Loading…</p>
      <p v-else-if="error" class="text-danger">{{ error }}</p>
      <div v-else class="d-flex flex-column gap-5">
        <PluginToolGroup v-for="group in groups" :key="group.className" :group="group" />
      </div>
    `,
  }),
};
