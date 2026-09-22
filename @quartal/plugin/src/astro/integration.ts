import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Helpers } from "../helpers/Helpers.ts";
import { buildCatchAllRouteSource, CATCH_ALL_ROUTE_FILE } from "./buildCatchAllRouteSource.ts";
import { qrtlCodegenPlugin } from "../vite/qrtlCodegenPlugin.ts";
import { pluginDevServerPlugin } from "../vite/pluginDevServer.ts";
import { discoverWidgetsSync, toWidgetCatalog } from "../widgets/discoverWidgets.ts";

/**
 * The `qrtlPlugin()` Astro integration. Turns a plain Astro project into a Quartal Plugin:
 * generates `qrtl-plugin/` metadata + `tools.registry.ts` from `src/tools/` (via the codegen Vite
 * plugin), discovers widget pages under `src/pages/widgets/`, and mounts the Hono app (REST/OpenAPI,
 * MCP, skills, icons, docs SPA, plugin-info, public) as middleware for the server-route prefixes.
 * Astro renders everything else (widget pages, user pages, its own assets). A catch-all route is
 * injected so the middleware-served paths are part of Astro's route table for the host platform.
 *
 * Widgets: discovered pages feed the plugin catalog at config time. There is NO build-time widget
 * bundling — the MCP resource for a widget is its live Astro page, fetched and URL-rewritten on
 * `resources/read` (see `../widgets/runtimeWidgets.ts`), so widgets work identically under
 * `astro dev` and a production build, and their `/_astro/*` chunks stay shared + HTTP-cacheable.
 */

/** The virtual module id whose `onRequest` Astro mounts as middleware. */
export const PLUGIN_MIDDLEWARE_VIRTUAL_ID = "virtual:@quartal/plugin/middleware";
const RESOLVED_PLUGIN_MIDDLEWARE_ID = "\0" + PLUGIN_MIDDLEWARE_VIRTUAL_ID;

/** Default location (relative to project root) of the generated artifacts + registries. */
const QRTL_PLUGIN_DIR = "src/qrtl-plugin";

/**
 * The server-rendered catch-all route injected so the Hono-served paths count as Astro routes for
 * the host platform's router (see `./catchAllRoute.ts`). The entrypoint is a module this
 * integration writes into the project (`buildCatchAllRouteSource`), resolved relative to the
 * project root. Astro reads the file while it creates the route manifest — before any Vite build
 * hook runs — so it is written from the `astro:config:setup` hook, not by the codegen.
 */
export const CATCH_ALL_ROUTE = {
  pattern: "/[...qrtlPath]",
  entrypoint: `./${QRTL_PLUGIN_DIR}/${CATCH_ALL_ROUTE_FILE}`,
  prerender: false,
};
/** Default widget pages directory (relative to project root). */
const WIDGETS_PAGES_DIR = "src/pages/widgets";
/** Index pages that override the docs shell at `/` (checked at config time; restart to pick up). */
const OWN_INDEX_PAGES = ["index.astro", "index.md", "index.mdx", "index.html", "index.ts", "index.js"];

/** Whether the plugin ships its own index page under `src/pages/` (overriding the docs shell).
 * @param root Plugin root directory.
 */
export function hasOwnIndexPage(root: string): boolean {
  return OWN_INDEX_PAGES.some((page) => existsSync(join(root, "src", "pages", page)));
}

/**
 * Options for {@link qrtlPlugin}. Deliberately minimal: everything about the plugin itself (auth
 * mode, title, style, widget names/CSP, deploy metadata) belongs in the plugin's `qrtl.config.ts`,
 * and the file layout (`src/tools/`, `src/pages/widgets/`, `src/qrtl-plugin/`) is a fixed
 * convention — only Astro-host concerns remain here.
 */
export interface QrtlPluginOptions {
  /**
   * Auth mode override: `"anon"` (`getAnonApp`) or `"quartal-hub"` / `"custom"` (`getAuthApp`).
   * @deprecated Set `auth` in `qrtl.config.ts` instead. When passed, this option wins over the
   * config file (and logs a deprecation warning).
   */
  auth?: "anon" | "quartal-hub" | "custom";
  /**
   * Whether to show the Astro dev toolbar in `astro dev` (default: `false`). Plugins are mostly
   * widget/API surfaces where the toolbar gets in the way, so the integration hides it centrally;
   * pass `true` to keep Astro's own default behavior (shown unless disabled elsewhere).
   */
  devToolbar?: boolean;
}

/**
 * Generates the source of the virtual middleware module. It imports the project's generated tool
 * registry, builds the Hono app once, and exports an Astro `onRequest` that delegates server routes.
 * Widget entries are discovered from the widget-pages directory when the app is built (metadata only —
 * the resource HTML is the live page, rendered per `resources/read`).
 * @param opts Resolved integration options.
 */
export function buildPluginMiddlewareSource(
  opts: {
    auth: "anon" | "quartal-hub" | "custom";
    root?: string;
    registryImport: string;
    promptsRegistryImport?: string;
    artifactsImport?: string;
    qrtlPluginDir?: string;
    ownIndexPage?: boolean;
  },
): string {
  // Any non-anon mode gets the auth app; getAuthApp reads the exact mode (quartal-hub / custom)
  // from the injected artifacts (or qrtl.config on disk when none are imported).
  const appFn = opts.auth === "anon" ? "getAnonApp" : "getAuthApp";
  const rootArg = opts.root ? `, pluginRootFolder: ${JSON.stringify(opts.root)}` : "";
  const pkgDirArg = opts.qrtlPluginDir ? `, qrtlPluginDir: ${JSON.stringify(opts.qrtlPluginDir)}` : "";
  const promptsImport = opts.promptsRegistryImport
    ? [`import { promptModules } from ${JSON.stringify(opts.promptsRegistryImport)};`]
    : [];
  const promptsArg = opts.promptsRegistryImport ? ", promptModules" : "";
  const artifactsImport = opts.artifactsImport
    ? [`import { artifacts } from ${JSON.stringify(opts.artifactsImport)};`]
    : [];
  const artifactsArg = opts.artifactsImport ? ", artifacts" : "";
  const middlewareOpts = opts.ownIndexPage ? `, { ownIndexPage: true }` : "";
  return [
    `// AUTO-GENERATED by @quartal/plugin — the server middleware for this Quartal Plugin.`,
    `import { toolModules } from ${JSON.stringify(opts.registryImport)};`,
    ...promptsImport,
    ...artifactsImport,
    `import { ${appFn}, createPluginMiddleware } from "@quartal/plugin";`,
    ``,
    `const appPromise = ${appFn}({ toolModules${promptsArg}${artifactsArg}${rootArg}${pkgDirArg} });`,
    `export const onRequest = createPluginMiddleware(() => appPromise${middlewareOpts});`,
    ``,
  ].join("\n");
}

/** Minimal Vite plugin shape used for the virtual middleware module (resolveId/load). */
interface VirtualModuleVitePlugin {
  name: string;
  resolveId(id: string): string | undefined;
  load(id: string): string | undefined;
}

function pluginMiddlewareVitePlugin(source: string): VirtualModuleVitePlugin {
  return {
    name: "qrtl-plugin-middleware",
    resolveId(id) {
      return id === PLUGIN_MIDDLEWARE_VIRTUAL_ID ? RESOLVED_PLUGIN_MIDDLEWARE_ID : undefined;
    },
    load(id) {
      return id === RESOLVED_PLUGIN_MIDDLEWARE_ID ? source : undefined;
    },
  };
}

/** Minimal structural subset of Astro's `astro:config:setup` hook argument. */
export interface AstroConfigSetupOptions {
  config: { output?: string; root?: URL | string; adapter?: unknown };
  updateConfig: (config: Record<string, unknown>) => void;
  addMiddleware: (opts: { entrypoint: string | URL; order: "pre" | "post" }) => void;
  injectRoute: (opts: { pattern: string; entrypoint: string | URL; prerender?: boolean }) => void;
  addWatchFile?: (path: string | URL) => void;
  logger?: { warn: (msg: string) => void; info: (msg: string) => void };
  command?: string;
}

/** Astro integration shape (structural — avoids a hard `astro` dependency). */
export interface AstroIntegration {
  name: string;
  hooks: {
    "astro:config:setup"?: (options: AstroConfigSetupOptions) => void | Promise<void>;
  };
}

function toPath(root: URL | string | undefined): string | undefined {
  if (!root) return undefined;
  if (typeof root === "string") return root;
  return root.protocol === "file:" ? fileURLToPath(root) : root.href;
}

/**
 * The Quartal Plugin Astro integration. Add to `astro.config.mjs`:
 * `import qrtlPlugin from "@quartal/plugin/astro"; export default defineConfig({ integrations: [qrtlPlugin()] });`
 * @param options Integration options.
 */
export function qrtlPlugin(options?: QrtlPluginOptions): AstroIntegration {
  const devToolbar = options?.devToolbar ?? false;
  const registryImport = `/${QRTL_PLUGIN_DIR}/tools.registry.ts`;
  const promptsRegistryImport = `/${QRTL_PLUGIN_DIR}/prompts.registry.ts`;
  const artifactsImport = `/${QRTL_PLUGIN_DIR}/artifacts.ts`;

  return {
    name: "@quartal/plugin",
    hooks: {
      "astro:config:setup": async ({ config, updateConfig, addMiddleware, injectRoute, addWatchFile, logger, command }) => {
        const root = toPath(config.root);

        // The auth mode comes from qrtl.config (`auth`), loaded strictly: a present-but-broken
        // config must abort the build, not silently downgrade an authenticated plugin to anonymous.
        const qrtlConfig = root ? await Helpers.loadQrtlConfig(root, { strict: true }) : undefined;
        if (options?.auth) {
          logger?.warn(
            `qrtlPlugin({ auth: "${options.auth}" }) is deprecated — set \`auth: "${options.auth}"\` in qrtl.config.ts instead.`,
          );
        }
        const auth = options?.auth ?? qrtlConfig?.auth ?? "anon";

        // The auth mode is baked into the generated middleware at config time, so a qrtl.config
        // edit must restart the dev server for this hook to run again.
        const qrtlConfigPath = root ? await Helpers.findQrtlConfigPath(root) : undefined;
        if (qrtlConfigPath) addWatchFile?.(qrtlConfigPath);

        // Discover widget pages so the catalog (contents.json) lists them. Synchronous so the plugins /
        // middleware are registered before this hook returns. The MCP resources themselves are resolved
        // at runtime (discovery + qrtl.config `widgets` merge) and served from the live pages.
        const widgets = root ? discoverWidgetsSync(join(root, WIDGETS_PAGES_DIR)) : [];

        // A plugin's own src/pages/index.* overrides the docs shell at "/": Astro renders it, and
        // only the machine routes stay with the Hono app. Checked at config time, like the auth
        // mode — adding or removing the page needs a dev-server restart.
        const ownIndexPage = root ? hasOwnIndexPage(root) : false;
        if (ownIndexPage) logger?.info("src/pages/index.* found — it overrides the plugin docs page at /.");

        const source = buildPluginMiddlewareSource({
          auth,
          root,
          registryImport,
          promptsRegistryImport,
          artifactsImport,
          qrtlPluginDir: QRTL_PLUGIN_DIR,
          ownIndexPage,
        });

        const plugins: unknown[] = [
          qrtlCodegenPlugin({
            cwd: root,
            entry: "src/tools/mod.ts",
            promptsEntry: "src/prompts/mod.ts",
            out: QRTL_PLUGIN_DIR,
            widgets: toWidgetCatalog(widgets),
          }),
          pluginMiddlewareVitePlugin(source),
        ];
        // Dev only: delegate hub server-routes to the Hono app before Vite serves physical root files
        // (so `astro dev` returns the generated contents.json for GET /package.json, not the npm manifest).
        if (root && command !== "build") {
          plugins.push(pluginDevServerPlugin({
            cwd: root,
            auth,
            qrtlPluginDir: QRTL_PLUGIN_DIR,
            registryPath: join(root, QRTL_PLUGIN_DIR, "tools.registry.ts"),
            promptsRegistryPath: join(root, QRTL_PLUGIN_DIR, "prompts.registry.ts"),
            ownIndexPage,
          }));
        }

        // Hide the Astro dev toolbar by default (it gets in the way of widget development inside
        // the MCP host iframe). Only merged when disabling, so `devToolbar: true` leaves the
        // project's own config/preferences untouched.
        updateConfig({
          vite: { plugins },
          ...(devToolbar ? {} : { devToolbar: { enabled: false } }),
        });

        addMiddleware({ entrypoint: PLUGIN_MIDDLEWARE_VIRTUAL_ID, order: "pre" });
        // Without a route for them, the Hono-served paths are "not found" to adapters that mirror
        // the route table into platform routing (Vercel forces status 404 on unrouted paths). The
        // route file must exist before Astro builds its route manifest, so it is written here; a
        // root that does not exist on disk is not a real project (unit tests) and gets no file.
        if (root && existsSync(root)) {
          const routeDir = join(root, QRTL_PLUGIN_DIR);
          mkdirSync(routeDir, { recursive: true });
          writeFileSync(join(routeDir, CATCH_ALL_ROUTE_FILE), buildCatchAllRouteSource());
        }
        injectRoute(CATCH_ALL_ROUTE);

        // The Hono app serves on-demand routes (REST/MCP/skills/…), so the project needs an
        // on-demand-capable output + an adapter.
        if (config.output !== "server") {
          logger?.warn(
            `@quartal/plugin needs on-demand rendering: set \`output: "server"\` (or mark the API/MCP `
              + `routes server-rendered) and configure an adapter (@astrojs/node, @astrojs/cloudflare, …).`,
          );
        }
      },
    },
  };
}
