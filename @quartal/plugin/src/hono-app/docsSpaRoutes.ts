import type { Hono } from "hono";
import { createDocsShellFetcher, resolveDocsWebUrl, rewriteDocsShellHtml } from "./docsShell.ts";
import { DEFAULT_DOCS_SKIN_URL, injectDocsSpaSkin } from "./docsSpaHtml.ts";

export interface DocsSpaRouteOptions {
  /** Bootstrap skin from the manifest `style.skin`; injected into the shell at serve time. */
  skinUrl?: string;
  /** Docs shell URL override (`PluginAppConfig.docsWebUrl`); `QRTL_DOCS_WEB_URL` wins over it. */
  docsWebUrl?: string;
}

/**
 * Serves the docs UI at `/`: the shell page published on the Quartal Plugins website is fetched
 * (cached in memory, see `docsShell.ts`), its asset references rewritten to the shell's origin,
 * the plugin's skin injected, and the result served from the plugin's own origin — so the SPA's
 * data fetches and the OAuth login flow stay same-origin while no docs assets ship with the plugin.
 * @param app Hono app to register routes on.
 * @param options Serve options (skin URL, shell URL override).
 */
export function registerDocsSpaRoutes(app: Hono, options?: DocsSpaRouteOptions): void {
  const shellUrl = resolveDocsWebUrl(options?.docsWebUrl);
  const getShell = createDocsShellFetcher(shellUrl);

  app.get("/", async (c) => {
    const html = await getShell();
    if (!html) {
      return c.text(
        `Plugin docs UI unavailable (could not load ${shellUrl}). The plugin's API and MCP `
          + `endpoints are unaffected. Set QRTL_DOCS_WEB_URL to a reachable docs shell to fix this.`,
        503,
      );
    }
    const skinUrl = options?.skinUrl ?? DEFAULT_DOCS_SKIN_URL;
    return c.html(injectDocsSpaSkin(rewriteDocsShellHtml(html, shellUrl), skinUrl));
  });

  app.get("/mcp.html", (c) => c.redirect("/#/mcp", 302));
  app.get("/swagger.html", (c) => c.redirect("/#/api/swagger", 302));
  app.get("/docs.html", (c) => c.redirect("/#/api/redoc", 302));
  app.get("/skills.html", (c) => {
    const skill = new URL(c.req.url).searchParams.get("skill");
    const dest = skill ? `/#/skills/${encodeURIComponent(skill)}` : "/#/skills";
    return c.redirect(dest, 302);
  });
  app.get("/agents.html", (c) => {
    const agent = new URL(c.req.url).searchParams.get("agent");
    const dest = agent ? `/#/agents/${encodeURIComponent(agent)}` : "/#/agents";
    return c.redirect(dest, 302);
  });
}
