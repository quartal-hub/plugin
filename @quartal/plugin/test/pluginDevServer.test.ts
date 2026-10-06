import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pluginDevServerPlugin } from "../src/vite/pluginDevServer.ts";
import type { ConnectMiddleware, ViteDevServerLike } from "../src/vite/qrtlCodegenPlugin.ts";

// The dev-server middleware must delegate hub server routes (e.g. /package.json) to the Hono app so
// `astro dev` serves the generated contents.json — not the physical package.json that Vite would
// otherwise serve — and must pass non-server routes (widget pages, Vite assets) through to `next()`.

const fixturePkg = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

/** Captures the connect middleware and the watcher listeners the plugin registers. */
function mountMiddleware(config?: { envDir: string; mode: string }): {
  handler: ConnectMiddleware;
  watched: string[];
  fire: (event: string, file: string) => void;
} {
  let handler: ConnectMiddleware | undefined;
  const watched: string[] = [];
  const listeners = new Map<string, ((file: string) => void)[]>();
  const server = {
    config,
    watcher: {
      add(paths: string | string[]) {
        for (const p of Array.isArray(paths) ? paths : [paths]) watched.push(p);
      },
      on(event: string, listener: (file: string) => void) {
        listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      },
    },
    middlewares: { use: (h: ConnectMiddleware) => { handler = h; } },
  } as unknown as ViteDevServerLike;
  pluginDevServerPlugin({
    cwd: fixturePkg,
    auth: "anon",
    qrtlPluginDir: "qrtl-plugin",
    registryPath: join(fixturePkg, "qrtl-plugin", "does-not-exist.registry.ts"), // tolerated: no toolModules
  }).configureServer!(server);
  if (!handler) throw new Error("middleware not registered");
  const fire = (event: string, file: string) => {
    for (const l of listeners.get(event) ?? []) l(file);
  };
  return { handler, watched, fire };
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
  it("loads Astro env files into process.env with Astro's file precedence", async () => {
    const envDir = await mkdtemp(join(tmpdir(), "qrtl-env-"));
    const name = "QRTL_TEST_DEV_ENV";
    const previous = process.env[name];
    delete process.env[name];
    try {
      await writeFile(join(envDir, ".env"), `${name}=base\n`);
      await writeFile(join(envDir, ".env.test"), `${name}=mode\n`);
      await writeFile(join(envDir, ".env.local"), `${name}=local\n`);
      await writeFile(join(envDir, ".env.test.local"), `${name}=mode-local\n`);

      mountMiddleware({ envDir, mode: "test" });
      expect(process.env[name]).toBe("mode-local");
    } finally {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
      await rm(envDir, { recursive: true, force: true });
    }
  });

  it("delegates GET /com.quartal.plugin/contents.json to the Hono app (serves generated contents.json)", async () => {
    const { handler } = mountMiddleware();
    const { nexted, status, body } = await invoke(handler, "/com.quartal.plugin/contents.json");
    expect(nexted).toBe(false);
    expect(status).toBe(200);
    const info = JSON.parse(body) as { name: string; tools: unknown[] };
    expect(info.name).toBe("@samples/test1");
    expect(Array.isArray(info.tools)).toBe(true); // the field the docs SPA reads (pkg.tools.length)
  });

  it("passes non-server routes (widget pages) through to next()", async () => {
    const { handler } = mountMiddleware();
    const { nexted } = await invoke(handler, "/widgets/add");
    expect(nexted).toBe(true);
  });

  it("adds Access-Control-Allow-Origin to dev responses (widget iframes load modules cross-origin)", async () => {
    const { handler } = mountMiddleware();
    const delegated = await invoke(handler, "/plugin.json");
    expect(delegated.headers["access-control-allow-origin"]).toBe("*");
    // Also set before falling through to Vite for module/asset requests.
    const passedThrough = await invoke(handler, "/widgets/add");
    expect(passedThrough.nexted).toBe(true);
    expect(passedThrough.headers["access-control-allow-origin"]).toBe("*");
  });

  it("watches the artifacts dir and rebuilds the app after a change event", async () => {
    const { handler, watched, fire } = mountMiddleware();
    expect(watched.some((p) => p.endsWith("qrtl-plugin"))).toBe(true);

    // Build the app once, invalidate via a change under qrtl-plugin, and confirm the middleware
    // still serves (i.e. the app is rebuilt, not left in a broken cached state).
    const first = await invoke(handler, "/com.quartal.plugin/contents.json");
    expect(first.status).toBe(200);
    fire("change", join(fixturePkg, "qrtl-plugin", "contents.json"));
    const second = await invoke(handler, "/com.quartal.plugin/contents.json");
    expect(second.status).toBe(200);
    expect(JSON.parse(second.body).name).toBe("@samples/test1");
  });
});
