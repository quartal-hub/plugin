import type { StorybookConfig } from "@storybook/vue3-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts)"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/vue3-vite",
    options: {},
  },
  viteFinal: async (config) => {
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const pluginCoreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../plugin-core/src");
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias["@quartal/plugin-core"] = path.join(pluginCoreRoot, "mod.ts");
    return config;
  },
};

export default config;
