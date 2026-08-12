import type { WidgetCsp } from "@quartal/plugin-core";

/**
 * A resolved widget: a tool id, its `ui://` resource URI, display name, and optional CSP. The widget
 * HTML is NOT stored here — `resources/read` renders the live Astro page (`/widgets/<toolId>`) on
 * demand and rewrites its asset URLs to absolute ones on the serving origin, so widgets load JS/CSS
 * as normal HTTP-cached requests instead of a re-bundled inline blob.
 */
export interface WidgetEntry {
  /** Tool id this widget visualizes. */
  toolId: string;
  /** `ui://widgets/<toolId>.html` — referenced from the tool's `_meta.ui.resourceUri`. */
  uri: string;
  /** Display name surfaced in `resources/list`. */
  name: string;
  /** Path of the live widget page on the serving origin. Default `/widgets/<toolId>`. */
  pagePath?: string;
  /** Shared CSP allow-lists for the sandboxed iframe, if any (the serving origin is added at read time). */
  csp?: WidgetCsp;
}
