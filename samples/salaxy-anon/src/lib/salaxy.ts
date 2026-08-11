// Lazy-load @salaxy/core and @salaxy/reports from a CDN at runtime — same
// pattern the original esm.sh widget used. Works on hosts whose iframe sandbox
// honors `_meta.ui.csp.resourceDomains` and `connectDomains` (MCP Jam always,
// Claude as of ext-apps#410 / claude-ai-mcp#40). Add the CDN origin to
// `qrtl.config.ts` `widgets.csp.resourceDomains` and `connectDomains` for it to load.
//
// Now that widget assets are served live from the plugin origin (shared,
// HTTP-cached /_astro chunks), these could instead be imported normally and
// code-split by Vite — kept on esm.sh for now to limit this change's scope.
//
// Type imports are erased at build time and only consulted by `vue-tsc`, so
// no @salaxy code ends up in the bundle.
import type * as SalaxyCore from "@salaxy/core";
import type * as SalaxyReports from "@salaxy/reports";

const SALAXY_CORE_URL = "https://esm.sh/@salaxy/core@6.0.0";
const SALAXY_REPORTS_URL = "https://esm.sh/@salaxy/reports@6.0.0";

export interface SalaxyModule {
  core: typeof SalaxyCore;
  reports: typeof SalaxyReports;
}

let promise: Promise<SalaxyModule> | null = null;

export function loadSalaxy(): Promise<SalaxyModule> {
  if (!promise) {
    promise = Promise.all([
      import(/* @vite-ignore */ SALAXY_CORE_URL),
      import(/* @vite-ignore */ SALAXY_REPORTS_URL),
    ]).then(([core, reports]) => ({ core, reports }));
  }
  return promise;
}
