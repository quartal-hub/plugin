import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pluginDevServerPlugin } from "../src/vite/pluginDevServer.ts";
import type { ConnectMiddleware, ViteDevServerLike } from "../src/vite/qrtlCodegenPlugin.ts";

// The dev-server middleware must delegate hub server routes (e.g. /package.json) to the Hono app so
// `astro dev` serves the generated contents.json — not the physical package.json that Vite would
// otherwise serve — and must pass non-server routes (widget pages, Vite assets) through to `next()`.

const fixturePkg = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

/** Captures the connect middleware the plugin registers. */
function mountMiddleware(): ConnectMiddleware {
  let handler: ConnectMiddleware | undefined;
  const server = {
    watcher: { add() {}, on() {} },
    middlewares: { use: (h: ConnectMiddleware) => { handler = h; } },
  } as unknown as ViteDevServerLike;
  pluginDevServerPlugin({
    cwd: fixturePkg,
    auth: "anon",
    qrtlPluginDir: "qrtl-plugin",
    registryPath: join(fixturePkg, "qrtl-plugin", "does-not-exist.registry.ts"), // tolerated: no toolModules
  }).configureServer!(server);
  if (!handler) throw new Error("middleware not registered");
  return handler;
}

/** Minimal Node req/res doubles; `run` resolves when the response is written or next() is called. */
function invoke(handler: ConnectMiddleware, url: string) {
  const req = { url, method: "GET", headers: { host: "localhost" } } as unknown as Parameters<ConnectMiddleware>[0];
  let status = 0;
  const chunks: Buffer[] = [];
  const headers: Record<string, string> = {};
  let resolve!: (v: { nexted: boolean }) => void;
  const done = new Promise<{ nexted: boolean }>((r) => { resolve = r; });
  const res = {
    statusCode: 0,
    setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; },
    end: (buf?: Buffer) => { status = res.statusCode; if (buf) chunks.push(Buffer.from(buf)); resolve({ nexted: false }); },
  } as unknown as Parameters<ConnectMiddleware>[1];
  handler(req, res as never, () => resolve({ nexted: true }));
  return done.then((r) => ({ ...r, status, headers, body: Buffer.concat(chunks).toString("utf-8") }));
}

describe("pluginDevServerPlugin", () => {
  it("delegates GET /plugin.json to the Hono app (serves generated contents.json)", async () => {
    const handler = mountMiddleware();
    const { nexted, status, body } = await invoke(handler, "/plugin.json");
    expect(nexted).toBe(false);
    expect(status).toBe(200);
    const info = JSON.parse(body) as { name: string; tools: unknown[] };
    expect(info.name).toBe("@samples/test1");
    expect(Array.isArray(info.tools)).toBe(true); // the field the docs SPA reads (pkg.tools.length)
  });

  it("passes non-server routes (widget pages) through to next()", async () => {
    const handler = mountMiddleware();
    const { nexted } = await invoke(handler, "/widgets/add");
    expect(nexted).toBe(true);
  });

  it("adds Access-Control-Allow-Origin to dev responses (widget iframes load modules cross-origin)", async () => {
    const handler = mountMiddleware();
    const delegated = await invoke(handler, "/plugin.json");
    expect(delegated.headers["access-control-allow-origin"]).toBe("*");
    // Also set before falling through to Vite for module/asset requests.
    const passedThrough = await invoke(handler, "/widgets/add");
    expect(passedThrough.nexted).toBe(true);
    expect(passedThrough.headers["access-control-allow-origin"]).toBe("*");
  });
});
