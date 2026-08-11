import { onMounted, type Ref, ref } from "vue";
import { connectWidget, type WidgetBridge } from "@quartal/plugin/widget";

/** Reactive handle over the MCP Apps host: tool result, parse error, host theme, and sendMessage. */
export interface ExtAppsHandle<TResult = unknown> {
  result: Ref<TResult | null>;
  error: Ref<string | null>;
  theme: Ref<"light" | "dark">;
  /**
   * Append a text message to the host's chat (e.g. a suggested follow-up tool call).
   * No-op until the host handshake completes.
   */
  sendMessage: (text: string) => Promise<void>;
}

/** Options for {@link useExtApps}. */
export interface UseExtAppsOptions<TResult = unknown> {
  name: string;
  version?: string;
  /** Optional transform from the parsed JSON tool result to the page's payload type. */
  parse?: (raw: unknown) => TResult;
}

/**
 * Vue composable over `@quartal/plugin/widget`'s framework-agnostic `connectWidget`. Exposes the host's
 * tool result + theme as reactive refs and a `sendMessage` helper backed by the underlying app.
 */
export function useExtApps<TResult = unknown>(opts: UseExtAppsOptions<TResult>): ExtAppsHandle<TResult> {
  const result = ref<TResult | null>(null) as Ref<TResult | null>;
  const error = ref<string | null>(null);
  const theme = ref<"light" | "dark">("light");
  let bridge: WidgetBridge<TResult> | null = null;

  onMounted(async () => {
    try {
      bridge = await connectWidget<TResult>({
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

  const sendMessage = async (text: string): Promise<void> => {
    if (!bridge) {
      console.warn("[useExtApps] sendMessage called before the host handshake completed; ignoring.");
      return;
    }
    await bridge.app.sendMessage({ role: "user", content: [{ type: "text", text }] });
  };

  return { result, error, theme, sendMessage };
}
