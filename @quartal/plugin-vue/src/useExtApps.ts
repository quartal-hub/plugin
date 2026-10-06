import { onMounted, type Ref, ref } from "vue";
import { connectWidget, type WidgetBridge, type WidgetDisplayMode, type WidgetTheme } from "@quartal/plugin/widget";

/** Reactive handle over the MCP Apps host: tool result, error, host theme, and sendMessage. */
export interface ExtAppsHandle<TResult = unknown> {
  /** Latest parsed tool result, or `null` before the first result arrives. */
  result: Ref<TResult | null>;
  /** Latest error message (tool execution error, cancellation, or parse failure), or `null`. */
  error: Ref<string | null>;
  /** Current host theme. */
  theme: Ref<WidgetTheme>;
  /** Current display mode of the widget. `inline` until the host says otherwise. */
  displayMode: Ref<WidgetDisplayMode>;
  /** The display modes the host allows. Empty when the host does not report them. */
  availableDisplayModes: Ref<WidgetDisplayMode[]>;
  /**
   * Ask the host to change the display mode, e.g. `fullscreen` for a dialog that does not fit the inline frame.
   * Resolves with the mode the host actually set. Waits for the host handshake.
   */
  requestDisplayMode: (mode: WidgetDisplayMode) => Promise<WidgetDisplayMode>;
  /**
   * Append a text message to the host's chat (e.g. a suggested follow-up tool call).
   * No-op until the host handshake completes.
   */
  sendMessage: (text: string) => Promise<void>;
  /**
   * Call one of the plugin's own tools (including `@visibility app` tools) and get its parsed result.
   * Waits for the host handshake; rejects when the tool fails or there is no host.
   */
  callTool: <T = unknown>(name: string, args?: Record<string, unknown>) => Promise<T>;
}

/** Options for {@link useExtApps}. */
export interface UseExtAppsOptions<TResult = unknown> {
  /** App name reported to the host in the `ui/initialize` handshake. */
  name: string;
  /** App version reported to the host. Default `"0.0.0"`. */
  version?: string;
  /** Optional transform from the parsed JSON tool result to the page's payload type. */
  parse?: (raw: unknown) => TResult;
  /**
   * Apply the host theme to `<html data-theme>` and `color-scheme`. Default `true`. Turn it off for a widget
   * whose look is fixed (a brand skin), so a dark host does not switch its form controls and scrollbars to dark.
   * `theme` is still reported.
   */
  applyTheme?: boolean;
  /** Report the widget's size to the host as it changes, so the frame fits the content. Default `true`. */
  autoResize?: boolean;
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
  const displayMode = ref<WidgetDisplayMode>("inline");
  const availableDisplayModes = ref<WidgetDisplayMode[]>([]);
  let bridge: WidgetBridge<TResult> | null = null;
  let markConnected: () => void;
  const connected = new Promise<void>((resolve) => { markConnected = resolve; });

  onMounted(async () => {
    try {
      bridge = await connectWidget<TResult>({
        name: opts.name,
        version: opts.version,
        parse: opts.parse,
        applyTheme: opts.applyTheme,
        autoResize: opts.autoResize,
        onResult: (r) => {
          result.value = r;
          error.value = null;
        },
        onError: (m) => { error.value = m; },
        onTheme: (t) => { theme.value = t; },
        onDisplayMode: (mode, available) => {
          displayMode.value = mode;
          availableDisplayModes.value = available;
        },
      });
      markConnected();
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

  const callTool = async <T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> => {
    await connected;
    return await bridge!.callTool<T>(name, args);
  };

  const requestDisplayMode = async (mode: WidgetDisplayMode): Promise<WidgetDisplayMode> => {
    await connected;
    return await bridge!.requestDisplayMode(mode);
  };

  return { result, error, theme, displayMode, availableDisplayModes, requestDisplayMode, sendMessage, callTool };
}
