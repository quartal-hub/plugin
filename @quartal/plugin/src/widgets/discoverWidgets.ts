import { readdirSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";

import type { WidgetCatalogEntry, WidgetCsp } from "../model/index.ts";

/**
 * Widget discovery for the Astro model: replaces the old `vue/widgets.json`. A widget is a page under
 * `src/pages/widgets/` whose file name (without extension) is the tool id it visualizes — e.g.
 * `src/pages/widgets/simpleSalary.astro` is the UI for the `simpleSalary` tool. The page may be authored
 * in any framework Astro supports. `astro dev` serves it at `/widgets/<toolId>`; the build turns it into
 * the self-contained MCP resource (see collectWidgetEntries.ts).
 */

/** Page extensions treated as widget pages. */
const WIDGET_PAGE_EXTENSIONS = new Set([".astro", ".vue", ".jsx", ".tsx", ".svelte", ".html"]);

/** A widget page found on disk, with its resolved display name and CSP. */
export interface DiscoveredWidget {
  /** Tool id the widget visualizes (the page file name without extension). */
  toolId: string;
  /** Absolute path of the source page file. */
  file: string;
  /** Display name surfaced in `resources/list` and the plugin catalog. */
  name: string;
  /** Resolved CSP for the sandboxed iframe (per-widget merged over the shared default), if any. */
  csp?: WidgetCsp;
}

/** Per-widget overrides keyed by tool id. */
export interface WidgetConfigEntry {
  /** Display name override (defaults to the tool id). */
  name?: string;
  /** CSP for this widget; merged over the shared {@link DiscoverWidgetsOptions.csp}. */
  csp?: WidgetCsp;
}

/** Options for {@link discoverWidgets}. */
export interface DiscoverWidgetsOptions {
  /** CSP applied to every widget (a per-widget `csp` extends/overrides it). */
  csp?: WidgetCsp;
  /** Per-widget overrides keyed by tool id (from `qrtl.config`), e.g. name and CSP. */
  entries?: Record<string, WidgetConfigEntry>;
}

/** Merges a shared CSP with a per-widget CSP (per-widget domains win; lists are concatenated + de-duped). */
export function mergeCsp(base?: WidgetCsp, override?: WidgetCsp): WidgetCsp | undefined {
  if (!base && !override) return undefined;
  const keys: (keyof WidgetCsp)[] = ["connectDomains", "resourceDomains", "frameDomains", "baseUriDomains"];
  const merged: WidgetCsp = {};
  for (const key of keys) {
    const combined = [...(base?.[key] ?? []), ...(override?.[key] ?? [])];
    if (combined.length > 0) merged[key] = [...new Set(combined)];
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/** Maps directory entries to sorted {@link DiscoveredWidget}s, applying naming + CSP rules. */
function buildDiscovered(
  dirEntries: string[],
  pagesWidgetsDir: string,
  options?: DiscoverWidgetsOptions,
): DiscoveredWidget[] {
  const widgets: DiscoveredWidget[] = [];
  for (const fileName of dirEntries) {
    if (fileName.startsWith("_")) continue;
    const ext = extname(fileName);
    if (!WIDGET_PAGE_EXTENSIONS.has(ext)) continue;
    const toolId = fileName.slice(0, -ext.length);
    if (!toolId) continue;
    const override = options?.entries?.[toolId];
    widgets.push({
      toolId,
      file: join(pagesWidgetsDir, fileName),
      name: override?.name ?? toolId,
      csp: mergeCsp(options?.csp, override?.csp),
    });
  }
  widgets.sort((a, b) => a.toolId.localeCompare(b.toolId));
  return widgets;
}

/**
 * Scans `pagesWidgetsDir` for widget pages and returns them sorted by tool id (stable output). Files
 * whose name starts with `_` (partials/layouts) are ignored. Missing directory → `[]`.
 * @param pagesWidgetsDir Absolute path to `src/pages/widgets`.
 * @param options Shared CSP and per-widget config overrides.
 */
export async function discoverWidgets(
  pagesWidgetsDir: string,
  options?: DiscoverWidgetsOptions,
): Promise<DiscoveredWidget[]> {
  try {
    return buildDiscovered(await readdir(pagesWidgetsDir), pagesWidgetsDir, options);
  } catch {
    return [];
  }
}

/**
 * Synchronous {@link discoverWidgets}. Used by the Astro integration's `astro:config:setup` hook, which
 * must feed the widget catalog into the codegen plugin before returning.
 * @param pagesWidgetsDir Absolute path to `src/pages/widgets`.
 * @param options Shared CSP and per-widget config overrides.
 */
export function discoverWidgetsSync(
  pagesWidgetsDir: string,
  options?: DiscoverWidgetsOptions,
): DiscoveredWidget[] {
  try {
    return buildDiscovered(readdirSync(pagesWidgetsDir), pagesWidgetsDir, options);
  } catch {
    return [];
  }
}

/** Projects discovered widgets to the catalog shape consumed by `generateTools`/`buildPluginInfo`. */
export function toWidgetCatalog(widgets: DiscoveredWidget[]): WidgetCatalogEntry[] {
  return widgets.map((w) => ({ toolId: w.toolId, name: w.name }));
}
