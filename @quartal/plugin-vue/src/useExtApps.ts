import { onMounted, type Ref, ref } from "vue";
import { connectWidget, type WidgetBridge, type WidgetTheme } from "@quartal/plugin/widget";

/** Reactive handle over the MCP Apps host: tool result, error, host theme, and sendMessage. */
export interface ExtAppsHandle<TResult = unknown> {
  /** Latest parsed tool result, or `null` before the first result arrives. */
  result: Ref<TResult | null>;
  /** Latest error message (tool execution error, cancellation, or parse failure), or `null`. */
  error: Ref<string | null>;
  /** Current host theme. */
  theme: Ref<WidgetTheme>;
  /**
   * Append a text message to the host's chat (e.g. a suggested follow-up tool call).
   * No-op until the host handshake completes.
   */
  sendMessage: (text: string) => Promise<void>;
}

/** Options for {@link useExtApps}. */
export interface UseExtAppsOptions<TResult = unknown> {
  /** App name reported to the host in the `ui/initialize` handshake. */
  name: string;
  /** App version reported to the host. Default `"0.0.0"`. */
  version?: string;
  /** Optional transform from the parsed JSON tool result to the page's payload type. */
  parse?: (raw: unknown) => TResult;
}

/**
 * Vue composable over `@quartal/plugin/widget`'s framework-agnostic `connectWidget`. Exposes the
 * host's tool result, errors (tool execution errors, cancellations, parse failures) and theme as
 * reactive refs, plus a `sendMessage` helper backed by the underlying app. All bridge logic lives
 * in `connectWidget`; this wrapper only adds the Vue reactivity.
 */
export function useExtApps<TResult = unknown>(opts: UseExtAppsOptions<TResult>): ExtAppsHandle<TResult> {
  const result = ref<TResult | null>(null) as Ref<TResult | null>;
  const error = ref<string | null>(null);
  const theme = ref<WidgetTheme>("light");
  let bridge: WidgetBridge<TResult> | null = null;

  onMounted(async () => {
    try {
      bridge = await connectWidget<TResult>({
        name: opts.name,
        version: opts.version,
        parse: opts.parse,
        onResult: (r) => {
          result.value = r;
          error.value = null;
        },
        onError: (m) => { error.value = m; },
        onTheme: (t) => { theme.value = t; },
      });
    } catch {
      // No MCP host in a plain browser preview — refs keep their initial values.
    }
  });

  const sendMessage = async (text: string): Promise<void> => {
    if (!bridge) {
      console.warn("[useExtApps] sendMessage called before the host handshake completed; ignoring.");
      return;
    }
    await bridge.app.sendMessage({ role: "user", content: [{ type: "text", text }] });
  };

  return { result, error, theme, sendMessage };
}
