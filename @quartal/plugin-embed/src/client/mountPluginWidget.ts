import type { CallToolResult, MountedWidget, MountWidgetOptions, PluginConnection, WidgetHostContext, WidgetTheme } from "../model/index.ts";
import { createWidgetHost, type WidgetHost } from "../host/createWidgetHost.ts";
import { errorToolResult, jsonToolResult } from "../host/toolResults.ts";

/** Sandbox flags of an embedded widget iframe. The widget runs on the plugin's own origin. */
export const WIDGET_IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";

/**
 * Shows a plugin tool's widget in an iframe appended to `container` (see
 * `PluginConnection.mountWidget`). The iframe loads the widget page from the plugin origin; in call
 * mode the tool runs over REST while the page loads.
 * @param plugin The plugin connection.
 * @param container Element the iframe is appended to.
 * @param options Tool, input or result, theme and callbacks.
 */
export function mountPluginWidget(plugin: PluginConnection, container: Element, options: MountWidgetOptions): MountedWidget {
  const doc = container.ownerDocument;
  const iframe = doc.createElement("iframe");
  iframe.setAttribute("sandbox", WIDGET_IFRAME_SANDBOX);
  iframe.className = "qrtl-widget-frame";
  iframe.style.cssText = "display:block;width:100%;border:0;height:150px;color-scheme:normal";
  iframe.title = options.title ?? options.tool;
  container.appendChild(iframe);

  const auth = { token: options.token, getToken: options.getToken };
  let host: WidgetHost | null = null;
  let disposed = false;
  let callSeq = 0;
  let pendingContext: WidgetHostContext = {};
  let args = options.args ?? {};
  /** The latest result, kept for a host that does not exist yet. */
  let delivered: CallToolResult | undefined;

  const deliver = (toolResult: CallToolResult): void => {
    delivered = toolResult;
    host?.sendToolResult(toolResult);
  };

  /** Shows a value the page already has (or the tool returned). */
  const showResult = (value: unknown): void => {
    deliver(jsonToolResult(value));
    options.onResult?.(value);
  };

  /** Calls the tool with the current input and shows its result; a newer call wins. */
  const run = (): void => {
    const seq = ++callSeq;
    plugin.callTool(options.tool, args, auth).then(
      (value) => {
        if (seq === callSeq && !disposed) showResult(value);
      },
      (error: unknown) => {
        // The host reports the error through onError when it delivers the result.
        if (seq === callSeq && !disposed) deliver(errorToolResult(error instanceof Error ? error.message : String(error)));
      },
    );
  };

  const ready = (async () => {
    const src = await plugin.widgetUrl(options.tool);
    if (disposed) return;
    host = createWidgetHost({
      ...options,
      iframe,
      src,
      toolName: options.tool,
      toolInput: args,
      toolResult: delivered,
      hostContext: { theme: options.theme ?? "light", ...options.hostContext, ...pendingContext },
      callTool: (name, callArgs, { signal }) => plugin.callToolResult(name, callArgs, { ...auth, signal }),
    });
    await host.ready;
  })();
  ready.catch((error: unknown) => options.onError?.(error instanceof Error ? error.message : String(error)));

  if (options.result !== undefined) showResult(options.result);
  else run();

  const setHostContext = (change: WidgetHostContext): void => {
    if (host) host.setHostContext(change);
    else pendingContext = { ...pendingContext, ...change };
  };

  return {
    iframe,
    ready,
    update(change) {
      if (change.args !== undefined) {
        args = change.args;
        host?.sendToolInput(args);
      }
      if (change.result !== undefined) {
        callSeq++;
        showResult(change.result);
      } else if (change.args !== undefined) {
        run();
      }
    },
    setTheme(theme: WidgetTheme) {
      setHostContext({ theme });
    },
    setHostContext,
    async dispose() {
      disposed = true;
      await host?.dispose();
      iframe.remove();
    },
  };
}
