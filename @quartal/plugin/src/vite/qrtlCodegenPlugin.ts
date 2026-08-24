import { resolve } from "node:path";
import { generateTools, type GenerateToolsOptions } from "../code/generateTools.ts";

/**
 * Minimal structural subset of Vite's `Plugin` — declared locally so this analysis package does not
 * take a hard dependency on `vite`. It is assignable to a real Vite `Plugin` when consumed by the
 * Astro integration.
 */
export interface VitePluginLike {
  name: string;
  buildStart?: () => void | Promise<void>;
  configureServer?: (server: ViteDevServerLike) => void | (() => void);
}

/** A Node-style connect middleware (`(req, res, next)`), as Vite's `server.middlewares.use` expects. */
export type ConnectMiddleware = (
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  next: (err?: unknown) => void,
) => void;

/** The slice of Vite's dev server these plugins touch (the file watcher + the connect middleware stack). */
export interface ViteDevServerLike {
  watcher: {
    add(paths: string | string[]): void;
    on(event: "add" | "change" | "unlink", listener: (path: string) => void): void;
  };
  middlewares?: {
    use(handler: ConnectMiddleware): void;
    /** Connect's internal layer stack. Used to position middleware relative to Astro's dev guards. */
    stack?: Array<{ route: string; handle: ConnectMiddleware }>;
  };
  /**
   * Vite's SSR module loader. Used to load the generated `tools.registry.ts` with proper TypeScript
   * transformation (parameter properties, enums, `.ts` specifiers) — raw Node import only strips types
   * and fails on those. Optional so test doubles need not provide it.
   */
  ssrLoadModule?: (url: string) => Promise<Record<string, unknown>>;
}

/** Options for {@link qrtlCodegenPlugin}. */
export interface QrtlCodegenPluginOptions extends GenerateToolsOptions {
  /**
   * Directories (relative to `cwd`) whose changes re-run codegen in dev. Default:
   * `["src/tools", "src/prompts", "skills", "agents"]`.
   */
  watchDirs?: string[];
}

/**
 * Vite plugin that generates the `qrtl-plugin/` metadata (and `tools.registry.ts`) from the plugin's
 * tools at build start, and regenerates on change during `vite dev`. Wire it into an Astro project
 * via the `qrtlPlugin()` integration, or directly in `astro.config`/`vite.config`.
 *
 * @param options Codegen + watch options. `cwd` defaults to the current working directory.
 */
export function qrtlCodegenPlugin(options?: QrtlCodegenPluginOptions): VitePluginLike {
  const cwd = options?.cwd ?? process.cwd();
  const watchDirs = (options?.watchDirs ?? ["src/tools", "src/prompts", "skills", "agents"]).map((d) => resolve(cwd, d));

  const run = () => generateTools(options);

  let running: Promise<void> | null = null;
  const runSafe = async (): Promise<void> => {
    if (running) return running;
    running = run()
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[qrtl-plugin-codegen] ${message}`);
      })
      .finally(() => {
        running = null;
      });
    return running;
  };

  return {
    name: "qrtl-plugin-codegen",
    async buildStart() {
      await run();
    },
    configureServer(server) {
      server.watcher.add(watchDirs);
      const onChange = (file: string): void => {
        if (watchDirs.some((dir) => file === dir || file.startsWith(dir + "/") || file.startsWith(dir + "\\"))) {
          void runSafe();
        }
      };
      server.watcher.on("add", onChange);
      server.watcher.on("change", onChange);
      server.watcher.on("unlink", onChange);
    },
  };
}
