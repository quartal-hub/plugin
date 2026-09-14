import type { AgentPluginManifest, PluginManifest, QuartalPluginExtension } from "../model/index.ts";
import { AGENT_PLUGIN_MANIFEST_SCHEMA, QUARTAL_EXTENSION_NAMESPACE } from "../model/index.ts";
import { mcpServerDisplayName, resolveHomepage } from "../hono-app/pluginMetadata.ts";

/**
 * Agent Plugins manifest `name`: 1–64 chars, lowercase alphanumeric with `-`/`.`, alphanumeric
 * start/end, no consecutive `--`/`..`. Derived from the plugin name's last segment.
 * @param pluginName The plugin (npm package) name, e.g. `@samples/test1`.
 */
export function agentPluginName(pluginName: string): string {
  const sanitized = mcpServerDisplayName(pluginName)
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/[-.]{2,}/g, "-")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  return (sanitized || "plugin").slice(0, 64);
}

/** Builds the Quartal extension block (relative URLs to the surfaces the spec does not cover).
 * @param widgetToolIds Tool ids that have an MCP Apps widget.
 */
export function buildQuartalExtension(widgetToolIds: string[] = []): QuartalPluginExtension {
  return {
    api: { openapi: "/open-api.json" },
    contents: `/${QUARTAL_EXTENSION_NAMESPACE}/contents.json`,
    packageZip: "/plugin.zip",
    ...(widgetToolIds.length ? { widgets: widgetToolIds } : {}),
  };
}

/** Shared optional identity fields of the standard and Claude manifests. */
function manifestIdentity(manifest: PluginManifest, origin?: string): Partial<AgentPluginManifest> {
  const homepage = resolveHomepage(manifest, origin);
  return {
    version: manifest.version,
    description: manifest.description,
    ...(manifest.author ? { author: manifest.author } : {}),
    ...(homepage ? { homepage } : {}),
    ...(manifest.repository ? { repository: manifest.repository.url } : {}),
    ...(manifest.license ? { license: manifest.license } : {}),
    ...(manifest.keywords?.length ? { keywords: manifest.keywords } : {}),
  };
}

/**
 * Builds the Agent Plugins 1.0 `plugin.json` manifest, served at `GET /plugin.json` and packaged
 * into `plugin.zip`.
 * @param manifest Resolved plugin manifest.
 * @param origin Request origin (homepage fallback).
 * @param extension The `com.quartal.plugin` extension block (see {@link buildQuartalExtension}).
 */
export function buildAgentPluginManifest(
  manifest: PluginManifest,
  origin?: string,
  extension?: QuartalPluginExtension,
): AgentPluginManifest {
  return {
    $schema: AGENT_PLUGIN_MANIFEST_SCHEMA,
    name: agentPluginName(manifest.name),
    ...manifestIdentity(manifest, origin),
    ...(extension ? { extensions: { [QUARTAL_EXTENSION_NAMESPACE]: extension as Record<string, unknown> } } : {}),
  };
}

/**
 * Builds the Claude Code `.claude-plugin/plugin.json` manifest (same identity fields, Claude's
 * manifest location and no `$schema`). Packaged into `plugin.zip` for the dual-manifest strategy.
 * @param manifest Resolved plugin manifest.
 * @param origin Request origin (homepage fallback).
 */
export function buildClaudePluginManifest(manifest: PluginManifest, origin?: string): Record<string, unknown> {
  return {
    name: agentPluginName(manifest.name),
    ...manifestIdentity(manifest, origin),
  };
}
