import type { PluginConnection } from "../model/index.ts";
import { connectPlugin } from "../client/connectPlugin.ts";

/**
 * The plugins a page has loaded, shared by every copy of this library on the page: each plugin's
 * `widgets.js` is its own bundle, and they all register into this one map (keyed by origin).
 */
const REGISTRY_KEY = Symbol.for("quartal.plugin-embed.plugins");

/** The page-wide plugin registry. */
export function pluginRegistry(): Map<string, PluginConnection> {
  const holder = globalThis as { [REGISTRY_KEY]?: Map<string, PluginConnection> };
  holder[REGISTRY_KEY] ??= new Map();
  return holder[REGISTRY_KEY];
}

/**
 * Registers a plugin connection so `<qrtl-widget>` elements can use it. A plugin already registered
 * for the same origin is kept.
 * @param plugin The connection.
 * @returns The registered connection for that origin.
 */
export function registerPlugin(plugin: PluginConnection): PluginConnection {
  const registry = pluginRegistry();
  const existing = registry.get(plugin.url);
  if (existing) return existing;
  registry.set(plugin.url, plugin);
  return plugin;
}

/**
 * Finds the plugin that serves a tool's widget: the one named by `pluginUrl` (connected and
 * registered on first use), else the only registered plugin, else the registered plugin whose route
 * table has the widget.
 * @param tool Tool id.
 * @param pluginUrl Plugin origin, when the page names it.
 */
export async function resolvePlugin(tool: string, pluginUrl?: string | null): Promise<PluginConnection> {
  const registry = pluginRegistry();
  if (pluginUrl) {
    return pluginConnection(pluginUrl);
  }
  const plugins = [...registry.values()];
  if (plugins.length === 1) return plugins[0];
  if (plugins.length === 0) {
    throw new Error(`No plugin loaded for widget "${tool}": load the plugin's widgets.js or set the plugin attribute.`);
  }
  for (const plugin of plugins) {
    try {
      if ((await plugin.routes()).widgets[tool]) return plugin;
    } catch {
      // That plugin is unreachable; try the next one.
    }
  }
  throw new Error(`None of the loaded plugins has a widget for tool "${tool}".`);
}

/**
 * The page's connection to a plugin: the registered one for its origin, or a new connection that
 * is registered for the next caller. Lets components on one page share the route table.
 * @param url Plugin origin.
 */
export function pluginConnection(url: string): PluginConnection {
  const origin = new URL(url, globalThis.location?.href).origin;
  return pluginRegistry().get(origin) ?? registerPlugin(connectPlugin({ url: origin }));
}
