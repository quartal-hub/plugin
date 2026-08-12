import type { IncomingMessage, ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";

import type { Hono } from "hono";
import { isServerPath } from "../astro/pluginMiddleware.ts";
import { getAnonApp } from "../hono-app/getAnonApp.ts";
import { getAuthApp } from "../hono-app/getAuthApp.ts";
import type { ToolModuleRegistry } from "../model/index.ts";
import type { VitePluginLike, ViteDevServerLike } from "./qrtlCodegenPlugin.ts";

/**
 * Dev-server middleware for `astro dev`: delegates the Quartal Plugin server routes (`/`, `/api`, `/mcp`,
 * `/skills`, `/icons`, `/plugin.json`, `/open-api.json`, …) to the Hono app.
 *
 * Why this exists: Vite's dev pipeline handles physically-present project files itself (e.g. `README.md`
 * → `/readme.md`), and Astro's dev route guard 404s browser navigations to them — so server routes that
 * coincide with real files would be shadowed under `astro dev`. Registering the delegating middleware
 * ahead of those layers means the Hono app serves its routes in dev exactly like in a production build
 * (where there is no Vite dev server and the injected Astro middleware handles them).
 */

/** Options for {@link pluginDevServerPlugin}. */
export interface PluginDevServerOptions {
  /** Plugin root (`pluginRootFolder`). */
  cwd: string;
  /** Auth mode. */
  auth: "anon" | "quartal-iam";
  /** Generated-artifact directory relative to `cwd` (e.g. `src/qrtl-plugin`). */
  qrtlPluginDir: string;
  /** Absolute path to the generated `tools.registry.ts` (imported for tool execution). */
  registryPath: string;
}

/** Reads the whole request body from a Node `IncomingMessage`. */
async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const method = (req.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

/** Converts a Node request to a Web `Request` against `origin`. */
async function toWebRequest(req: IncomingMessage, origin: string): Promise<Request> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) for (const v of value) headers.append(key, v);
    else if (value != null) headers.set(key, value);
  }
  const body = await readBody(req);
  return new Request(origin + (req.url ?? "/"), {
    method: req.method ?? "GET",
    headers,
    ...(body ? { body } : {}),
  });
}

/** Writes a Web `Response` to a Node `ServerResponse`. */
async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}

/**
 * Builds the Vite plugin that mounts the Hono app as dev middleware. The app is built once, lazily, on
 * the first server-route request (after codegen's `buildStart` has generated the registries).
 * @param options Resolved dev-server options.
 */
export function pluginDevServerPlugin(options: PluginDevServerOptions): VitePluginLike {
  let appPromise: Promise<Hono> | undefined;

  const loadToolModules = async (server?: ViteDevServerLike): Promise<ToolModuleRegistry | undefined> => {
    // The registry is emitted by the codegen plugin's buildStart; load it lazily. Prefer Vite's SSR
    // loader so the tool sources are TS-transformed (parameter properties, enums, `.ts` specifiers) —
    // a raw Node import only strips types and throws on those. Fall back to raw import (e.g. in tests
    // without a Vite server). Tolerate failure: docs + metadata still work; only execution needs it.
    try {
      if (server?.ssrLoadModule) {
        const url = `/${options.qrtlPluginDir.replace(/\\/g, "/")}/tools.registry.ts`;
        const mod = await server.ssrLoadModule(url);
        return (mod as { toolModules?: ToolModuleRegistry }).toolModules;
      }
      const mod = (await import(/* @vite-ignore */ pathToFileURL(options.registryPath).href)) as {
        toolModules?: ToolModuleRegistry;
      };
      return mod.toolModules;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[qrtl-plugin-dev-server] Could not load tools.registry.ts — tool execution is disabled. ${message}`);
      return undefined;
    }
  };

  const getApp = (server?: ViteDevServerLike): Promise<Hono> => {
    appPromise ??= (async (): Promise<Hono> => {
      const toolModules = await loadToolModules(server);
      // Widget resources are discovered from src/pages/widgets at app build and served live, so MCP
      // widgets work in `astro dev` without a prior `astro build`.
      const config = {
        pluginRootFolder: options.cwd,
        qrtlPluginDir: options.qrtlPluginDir,
        ...(toolModules ? { toolModules } : {}),
      };
      return options.auth === "quartal-iam" ? await getAuthApp(config) : await getAnonApp(config);
    })();
    return appPromise;
  };

  return {
    name: "qrtl-plugin-dev-server",
    configureServer(server) {
      if (!server.middlewares) return;
      const delegate: import("./qrtlCodegenPlugin.ts").ConnectMiddleware = (req, res, next) => {
        // Widget iframes load Vite-served modules cross-origin (from the host sandbox origin), and the
        // dev module graph escapes the /widget-assets passthrough via root-relative nested imports
        // (/node_modules/…, /@id/…) — so in dev, allow CORS on everything.
        res.setHeader("Access-Control-Allow-Origin", "*");
        const pathname = (req.url ?? "/").split("?")[0];
        if (!isServerPath(pathname)) {
          next();
          return;
        }
        void (async () => {
          const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? "http";
          const host = req.headers.host ?? "localhost";
          const app = await getApp(server);
          const response = await app.fetch(await toWebRequest(req, `${proto}://${host}`));
          await writeResponse(res, response);
        })().catch(next);
      };
      server.middlewares.use(delegate);
      // Astro's dev route guard (`devRouteGuard`, Astro 7+) 404s browser navigations (`Accept:
      // text/html`) to paths that exist as files in the project root — which shadows the served
      // `/readme.md` (every plugin project has a README.md; Windows/macOS match it case-insensitively).
      // The guard is unshifted to the front of the connect stack, ahead of all plugin middlewares, so
      // move our delegation directly in front of it (but behind Astro's sec-fetch protection).
      // Production has no such guard — this restores dev/prod parity for the server routes. Done in
      // Vite's post hook, which runs after every plugin's `configureServer` body (i.e. after Astro
      // unshifted its guards).
      return () => {
        const stack = server.middlewares?.stack;
        if (!Array.isArray(stack)) return;
        const guardIndex = stack.findIndex((layer) => layer?.handle?.name === "devRouteGuard");
        const selfIndex = stack.findIndex((layer) => layer?.handle === delegate);
        if (guardIndex >= 0 && selfIndex > guardIndex) {
          const [self] = stack.splice(selfIndex, 1);
          stack.splice(guardIndex, 0, self);
        }
      };
    },
  };
}
