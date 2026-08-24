import type { Hono } from "hono";
import { getPkgDocsWebStaticRoot } from "./docsUiPath.ts";
import { DEFAULT_DOCS_SKIN_URL, injectDocsSpaSkin } from "./docsSpaHtml.ts";
import { guessStaticMime, readStaticBytes, readStaticText, resolveUnderRootUrl } from "./staticFileUtils.ts";

export interface DocsSpaRouteOptions {
  /** Bootstrap skin from the manifest `style.skin`; injected into index.html at serve time. */
  skinUrl?: string;
}

/**
 * Serves the vendored docs SPA at `/` and `/assets/*`. Static files live in
 * `@quartal/plugin/static/plugin-docs-web` (vendored from `@quartal/plugin-docs-web`).
 * @param app Hono app to register routes on.
 * @param options Serve options (skin URL).
 */
export function registerDocsSpaRoutes(app: Hono, options?: DocsSpaRouteOptions): void {
  const root = getPkgDocsWebStaticRoot();
  const indexUrl = new URL("index.html", root);

  app.get("/assets/:file{.+}", async (c) => {
    const sub = c.req.param("file") ?? "";
    const fileUrl = resolveUnderRootUrl(new URL("assets/", root), sub);
    if (!fileUrl) return c.text("Not found", 404);
    const bytes = await readStaticBytes(fileUrl);
    if (!bytes) return c.text("Not found", 404);
    return c.body(new Uint8Array(bytes), 200, { "Content-Type": guessStaticMime(sub) });
  });

  app.get("/", async (c) => {
    const html = await readStaticText(indexUrl);
    if (!html) {
      return c.text(
        `Plugin docs UI not installed (missing ${indexUrl.href}). Upgrade @quartal/plugin or re-vendor the docs SPA.`,
        503,
      );
    }
    const skinUrl = options?.skinUrl ?? DEFAULT_DOCS_SKIN_URL;
    return c.html(injectDocsSpaSkin(html, skinUrl));
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
