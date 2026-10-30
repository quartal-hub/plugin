import { type MaybeRefOrGetter, type Ref, ref, shallowRef, toValue, watch } from "vue";
import type { PluginAuth } from "../model/index.ts";
import { pluginConnection } from "../element/pluginRegistry.ts";

/** Options of {@link usePluginTool}. */
export interface UsePluginToolOptions extends PluginAuth {
  /** Set to `false` to hold the call (e.g. until the input is complete). Default `true`. */
  enabled?: MaybeRefOrGetter<boolean>;
}

/** State of a tool call made by {@link usePluginTool}. */
export interface PluginToolState<T> {
  /** The latest JSON result. */
  data: Ref<T | undefined>;
  /** The error of the latest call. */
  error: Ref<Error | undefined>;
  /** A call is running. */
  loading: Ref<boolean>;
  /** Calls the tool again with the same input. */
  refetch: () => void;
}

/**
 * Calls a plugin tool over REST and keeps its result in refs. Calls again when `url`, `tool` or the
 * input (compared as JSON) change; an older call that finishes late is discarded.
 * @param url The plugin's origin.
 * @param tool Tool id.
 * @param args The tool's input object.
 * @param options Auth and `enabled`.
 */
export function usePluginTool<T = unknown>(
  url: MaybeRefOrGetter<string>,
  tool: MaybeRefOrGetter<string>,
  args: MaybeRefOrGetter<Record<string, unknown>> = {},
  options: UsePluginToolOptions = {},
): PluginToolState<T> {
  const data = shallowRef<T>();
  const error = shallowRef<Error>();
  const loading = ref(false);
  let controller: AbortController | null = null;

  const call = (): void => {
    controller?.abort();
    if (toValue(options.enabled) === false) return;
    const current = new AbortController();
    controller = current;
    loading.value = true;
    error.value = undefined;
    pluginConnection(toValue(url))
      .callTool<T>(toValue(tool), JSON.parse(JSON.stringify(toValue(args))) as Record<string, unknown>, {
        signal: current.signal,
        getToken: async () => (options.getToken ? await options.getToken() : options.token),
      })
      .then(
        (value) => {
          if (current.signal.aborted) return;
          data.value = value;
          loading.value = false;
        },
        (e: unknown) => {
          if (current.signal.aborted) return;
          error.value = e instanceof Error ? e : new Error(String(e));
          loading.value = false;
        },
      );
  };

  watch(
    () => [toValue(url), toValue(tool), JSON.stringify(toValue(args)), toValue(options.enabled)],
    call,
    { immediate: true },
  );

  return { data, error, loading, refetch: call };
}
