import type { Implementation } from "@modelcontextprotocol/sdk/types.js";
import type { McpServerOptions, PluginIcon, PluginManifest } from "../model/index.ts";
import { mcpServerDisplayName, resolveHomepage } from "./pluginMetadata.ts";

export { mcpServerDisplayName } from "./pluginMetadata.ts";

/**
 * Pure icon helpers plus the MCP server-implementation builder. The icon-serving routes
 * (`/icons/:index`) are registered by the runtime server layer (a later slice).
 */

/** MCP icon entry shape (matches @modelcontextprotocol/sdk Implementation.icons). */
export type McpIconEntry = {
  src: string;
  mimeType?: string;
  sizes?: string[];
  theme?: "light" | "dark";
};

/** Path served on this host for icon at `index` (same-origin for MCP clients). */
export function iconServePath(index: number): string {
  return `/icons/${index}`;
}

/** Primary icon path for favicon and HTML `<link rel="icon">`. */
export function primaryIconPath(): string {
  return iconServePath(0);
}

/** Guesses image MIME type from a URL path extension. */
export function guessIconMimeType(iconUrl: string): string {
  const lower = iconUrl.toLowerCase();
  if (lower.includes(".svg")) return "image/svg+xml";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  if (lower.includes(".gif")) return "image/gif";
  if (lower.startsWith("data:image/svg")) return "image/svg+xml";
  return "image/png";
}

/** MCP `icons` metadata pointing at same-origin `/icons/{index}` routes. */
export function buildServedMcpIcons(icons: PluginIcon[]): McpIconEntry[] {
  return icons.map((icon, index) => ({
    src: iconServePath(index),
    ...(icon.mimeType ? { mimeType: icon.mimeType } : { mimeType: guessIconMimeType(icon.src) }),
    ...(icon.sizes?.length ? { sizes: icon.sizes } : {}),
    ...(icon.theme ? { theme: icon.theme } : {}),
  }));
}

/** MCP `initialize` server implementation from plugin metadata. */
export function buildMcpServerImplementation(
  manifest: PluginManifest,
  options?: McpServerOptions,
  serverOrigin?: string,
): Implementation {
  const name = mcpServerDisplayName(manifest.name, options?.name);
  const websiteUrl = resolveHomepage(manifest, serverOrigin);
  return {
    name,
    version: manifest.version,
    title: manifest.title,
    description: manifest.description,
    ...(websiteUrl ? { websiteUrl } : {}),
    icons: buildServedMcpIcons(manifest.style.icons),
  };
}
