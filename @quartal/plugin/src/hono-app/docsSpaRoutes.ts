import type { Hono } from "hono";
import { createDocsShellFetcher, resolveDocsWebUrl, rewriteDocsShellHtml } from "./docsShell.ts";
import { DEFAULT_DOCS_SKIN_URL, injectDocsSpaSkin, injectDocsSpaTitle } from "./docsSpaHtml.ts";
import type { QrtlSiteConfig } from "../model/index.ts";

export interface DocsSpaRouteOptions {
  /** Bootstrap skin from the manifest `style.skin`; injected into the shell at serve time. */
  skinUrl?: string;
  /** Docs shell URL override (`PluginAppConfig.docsWebUrl`); `QRTL_DOCS_WEB_URL` wins over it. */
  docsWebUrl?: string;
  /** The plugin's title; the page title becomes `<title> - Quartal Plugin`. */
  title?: string;
  /**
   * `qrtl.config` `site.root` as `{ redirect }`: `/` and the docs paths redirect there instead of
   * serving the docs site (see {@link resolveSiteRedirect}).
   */
  redirect?: string;
  /** The plugin's name, for `{name}` in {@link DocsSpaRouteOptions.redirect}. */
  name?: string;
}

/**
 * The redirect options of {@link registerDocsSpaRoutes} for a `site` config: set when `site.root`
 * is `{ redirect }`, empty otherwise.
 * @param site The `qrtl.config` `site` options.
 * @param name The plugin's name.
 */
export function siteRedirectOptions(site: QrtlSiteConfig | undefined, name: string): Pick<DocsSpaRouteOptions, "redirect" | "name"> {
  const root = site?.root;
  return typeof root === "object" && root.redirect ? { redirect: root.redirect, name } : {};
}

/** The docs site's paths: the shell and the redirects into its hash routes. */
const DOCS_PATHS = ["/", "/mcp.html", "/swagger.html", "/docs.html", "/skills.html", "/agents.html"];

/**
 * Resolves a `site.root` redirect for a request: `{name}` and `{origin}` are replaced, URL-encoded.
 * @param template The redirect URL with placeholders.
 * @param name The plugin's name.
 * @param origin The request origin.
 */
export function resolveSiteRedirect(template: string, name: string, origin: string): string {
  return template.replaceAll("{name}", encodeURIComponent(name)).replaceAll("{origin}", encodeURIComponent(origin));
}

/**
 * Serves the docs UI at `/`: the shell page published on the Quartal Plugins website is fetched
 * (cached in memory, see `docsShell.ts`), its asset references rewritten to the shell's origin,
 * the plugin's skin and page title injected, and the result served from the plugin's own origin — so the SPA's
 * data fetches and the OAuth login flow stay same-origin while no docs assets ship with the plugin.
 * @param app Hono app to register routes on.
 * @param options Serve options (skin URL, shell URL override).
 */
export function registerDocsSpaRoutes(app: Hono, options?: DocsSpaRouteOptions): void {
  const redirect = options?.redirect;
  if (redirect) {
    for (const path of DOCS_PATHS) {
      app.get(path, (c) => c.redirect(resolveSiteRedirect(redirect, options?.name ?? "", new URL(c.req.url).origin), 302));
    }
    return;
  }
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
    return c.html(injectDocsSpaTitle(injectDocsSpaSkin(rewriteDocsShellHtml(html, shellUrl), skinUrl), options?.title));
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
