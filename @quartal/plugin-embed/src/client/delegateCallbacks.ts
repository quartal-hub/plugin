import type { WidgetCallbacks } from "../model/index.ts";

/**
 * Callbacks that forward to whatever the latest callbacks are when the widget calls them, with the
 * host's defaults for links and display modes when no handler is given. Framework components pass
 * these once at mount and keep their props current behind `latest`.
 * @param latest Returns the current callbacks.
 */
export function delegateCallbacks(latest: () => WidgetCallbacks): Required<WidgetCallbacks> {
  return {
    onReady: () => latest().onReady?.(),
    onToolCall: (call) => latest().onToolCall?.(call),
    onToolResult: (result) => latest().onToolResult?.(result),
    onMessage: (message) => latest().onMessage?.(message),
    onModelContext: (context) => latest().onModelContext?.(context),
    onOpenLink: (url) => {
      const handler = latest().onOpenLink;
      if (handler) return handler(url);
      globalThis.open?.(url, "_blank", "noopener,noreferrer");
    },
    onDisplayMode: (mode, context) => {
      const handler = latest().onDisplayMode;
      if (handler) return handler(mode, context);
      return (context.availableDisplayModes ?? ["inline"]).includes(mode) ? mode : context.displayMode ?? "inline";
    },
    onSize: (size) => latest().onSize?.(size),
    onLog: (entry) => latest().onLog?.(entry),
    onError: (message) => latest().onError?.(message),
  };
}
