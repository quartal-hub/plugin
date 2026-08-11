import type { OpenAPIHono } from "@hono/zod-openapi";
import type { PluginIcon } from "../model/index.ts";
import { getCachedIcon } from "./iconCache.ts";

/** Registers `/icons/:index` and `/favicon.ico` (serves cached icon bytes, not redirects).
 * @param app OpenAPIHono app to register routes on.
 * @param icons Plugin icons from the manifest.
 */
export function registerIconRoutes(app: OpenAPIHono, icons: PluginIcon[]): void {
  app.get("/icons/:index", async (c) => {
    const index = Number(c.req.param("index"));
    if (!Number.isInteger(index) || index < 0 || index >= icons.length) {
      return c.notFound();
    }
    const icon = icons[index]!;
    try {
      const { body, mimeType } = await getCachedIcon(icon.src, icon.mimeType);
      return new Response(new Uint8Array(body), {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[icons/${index}] ${message}`);
      return c.text("Icon unavailable", 502);
    }
  });

  if (icons.length > 0) {
    app.get("/favicon.ico", (c) => c.redirect(`/icons/0`, 302));
  }
}
