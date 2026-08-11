import { onMounted, type Ref, ref } from "vue";
import { connectWidget } from "@quartal/plugin/widget";

/** Reactive handle over the MCP Apps host: latest tool result, parse error, and host theme. */
export interface ExtAppsHandle<TResult = unknown> {
  result: Ref<TResult | null>;
  error: Ref<string | null>;
  theme: Ref<"light" | "dark">;
}

/** Options for {@link useExtApps}. */
export interface UseExtAppsOptions<TResult = unknown> {
  name: string;
  version?: string;
  /** Optional transform from the parsed JSON tool result to the page's payload type. */
  parse?: (raw: unknown) => TResult;
}

/**
 * Vue composable over `@quartal/plugin/widget`'s framework-agnostic `connectWidget`. Subscribes to the
 * host's tool result + theme and exposes them as reactive refs.
 */
export function useExtApps<TResult = unknown>(opts: UseExtAppsOptions<TResult>): ExtAppsHandle<TResult> {
  const result = ref<TResult | null>(null) as Ref<TResult | null>;
  const error = ref<string | null>(null);
  const theme = ref<"light" | "dark">("light");

  onMounted(async () => {
    try {
      await connectWidget<TResult>({
        name: opts.name,
        version: opts.version,
        parse: opts.parse,
        onResult: (r) => { result.value = r; },
        onError: (m) => { error.value = m; },
        onTheme: (t) => { theme.value = t; },
      });
    } catch {
      // No MCP host in a plain browser preview — refs keep their initial values.
    }
  });

  return { result, error, theme };
}
