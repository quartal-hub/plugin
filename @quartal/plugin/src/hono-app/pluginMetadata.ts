import type { PluginManifest } from "../model/index.ts";

/** Default icon `sizes` when omitted in the manifest. */
export const DEFAULT_ICON_SIZES = ["128x128"];

/**
 * MCP server `name`: scoped plugin names use the last path segment; leading `@` is removed.
 * Example: `@samples/auth-agent` → `auth-agent`.
 */
export function mcpServerDisplayName(pluginName: string, override?: string): string {
  const raw = (override ?? pluginName).trim();
  const segment = raw.includes("/") ? raw.split("/").pop()! : raw;
  return segment.startsWith("@") ? segment.slice(1) : segment;
}

/** Derives an end-user-friendly title from plugin name and description. */
export function derivePluginTitle(name: string, description?: string): string {
  const segment = mcpServerDisplayName(name);
  const fromName = segment
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  if (fromName) return fromName;
  const first = description?.split(/[.!?]/)[0]?.trim();
  return first && first.length <= 80 ? first : name;
}

/** Primary site link: explicit homepage, else the current server origin. */
export function resolveHomepage(manifest: PluginManifest, serverOrigin?: string): string | undefined {
  return manifest.homepage ?? serverOrigin;
}

/** OpenAPI / docs description including the technical plugin name. */
export function openApiDescription(manifest: PluginManifest): string {
  const nameLine = `Plugin: \`${manifest.name}\` (${manifest.version})`;
  if (manifest.description.includes(manifest.name)) {
    return manifest.description;
  }
  return `${manifest.description}\n\n${nameLine}`;
}

/** OpenAPI `info` block for runtime or code-gen. */
export function buildOpenApiInfo(
  manifest: PluginManifest,
  serverOrigin?: string,
): Record<string, unknown> {
  const homepage = resolveHomepage(manifest, serverOrigin);
  return {
    version: manifest.version,
    title: manifest.title,
    description: openApiDescription(manifest),
    ...(homepage ? { contact: { url: homepage } } : {}),
    "x-logo": {
      url: manifest.style.logo,
      altText: manifest.title,
      ...(homepage ? { href: homepage } : {}),
    },
  };
}
