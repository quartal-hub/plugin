import { readFile, stat } from "node:fs/promises";
import { statSync } from "node:fs";
import { join } from "node:path";
import type { Hono } from "hono";
import { guessStaticMime, resolveUnderRoot } from "./staticFileUtils.ts";

/**
 * Serves files from the plugin's `public/` folder at the site root (Vue-style public dir).
 * Register after other routes so existing handlers take precedence.
 * @param app Hono app to register the catch-all on.
 * @param pluginRootFolder Plugin root (defaults to cwd).
 */
export function registerPublicFolderRoutes(app: Hono, pluginRootFolder?: string): void {
  const publicRoot = join(pluginRootFolder ?? process.cwd(), "public");
  try {
    if (!statSync(publicRoot).isDirectory()) return;
  } catch {
    return;
  }

  app.get("*", async (c) => {
    const pathname = new URL(c.req.url).pathname;
    if (pathname === "/") return c.notFound();

    const relativePath = decodeURIComponent(pathname.slice(1));
    const filePath = resolveUnderRoot(publicRoot, relativePath);
    if (!filePath) return c.notFound();

    try {
      const st = await stat(filePath);
      if (!st.isFile()) return c.notFound();
      const bytes = new Uint8Array(await readFile(filePath));
      return c.body(bytes, 200, {
        "Content-Type": guessStaticMime(relativePath),
        "Cache-Control": "public, max-age=3600",
      });
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return c.notFound();
      throw e;
    }
  });
}
