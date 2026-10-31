import { useCallback, useEffect, useRef, useState } from "react";
import type { PluginAuth } from "../model/index.ts";
import { pluginConnection } from "../element/pluginRegistry.ts";

/** Options of {@link usePluginTool}. */
export interface UsePluginToolOptions extends PluginAuth {
  /** Set to `false` to hold the call (e.g. until the input is complete). Default `true`. */
  enabled?: boolean;
}

/** State of a tool call made by {@link usePluginTool}. */
export interface PluginToolState<T> {
  /** The latest JSON result. */
  data: T | undefined;
  /** The error of the latest call. */
  error: Error | undefined;
  /** A call is running. */
  loading: boolean;
  /** Calls the tool again with the same input. */
  refetch: () => void;
}

/**
 * Calls a plugin tool over REST and keeps its result in state. Calls again when `url`, `tool` or the
 * input (compared as JSON) change; an older call that finishes late is discarded.
 * @param url The plugin's origin.
 * @param tool Tool id.
 * @param args The tool's input object.
 * @param options Auth and `enabled`.
 */
export function usePluginTool<T = unknown>(
  url: string,
  tool: string,
  args: Record<string, unknown> = {},
  options: UsePluginToolOptions = {},
): PluginToolState<T> {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: enabled });
  const [run, setRun] = useState(0);
  const auth = useRef<PluginAuth>(options);
  auth.current = options;
  const argsKey = JSON.stringify(args);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState((s) => ({ data: s.data, loading: true }));
    pluginConnection(url)
      .callTool<T>(tool, JSON.parse(argsKey) as Record<string, unknown>, {
        signal: controller.signal,
        getToken: async () => (auth.current.getToken ? await auth.current.getToken() : auth.current.token),
      })
      .then(
        (data) => {
          if (!controller.signal.aborted) setState({ data, loading: false });
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          setState((s) => ({ data: s.data, error: error instanceof Error ? error : new Error(String(error)), loading: false }));
        },
      );
    return () => controller.abort();
  }, [url, tool, argsKey, enabled, run]);

  const refetch = useCallback(() => setRun((n) => n + 1), []);
  return { data: state.data, error: state.error, loading: state.loading, refetch };
}
