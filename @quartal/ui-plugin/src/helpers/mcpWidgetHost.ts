import {
  AppBridge,
  type McpUiHostCapabilities,
  type McpUiHostContext,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolRequest, CallToolResult, Implementation } from "@modelcontextprotocol/sdk/types.js";
import type { McpToolResult } from "./mcpToolTester.ts";

/** Host color theme reported to the widget. */
export type WidgetTheme = "light" | "dark";

/** A structured log line surfaced from the widget (either MCP logging or bridge activity). */
export interface WidgetLogEntry {
  /** Log level or activity kind. */
  level: string;
  /** Origin label (logger name or protocol method). */
  source: string;
  /** Payload (message text, arguments, url, …). */
  data: unknown;
}

/** Callbacks the host forwards to the embedder so it can render an activity log. */
export interface WidgetHostCallbacks {
  /** Fired once the widget finishes its `ui/initialize` handshake and has received input + result. */
  onInitialized?: () => void;
  /** Fired when the widget reports a new content size (`ui/notifications/size-changed`). */
  onSizeChange?: (size: { width?: number; height?: number }) => void;
  /** Fired for every activity worth logging (tool calls, links, messages, host logs). */
  onLog?: (entry: WidgetLogEntry) => void;
  /** Fired when a widget-initiated `tools/call` starts (before it is forwarded to the server). */
  onCallTool?: (name: string, args: Record<string, unknown> | undefined) => void;
  /** Fired for an unrecoverable host error. */
  onError?: (message: string) => void;
}

/** Options for {@link mountWidget}. */
export interface MountWidgetOptions extends WidgetHostCallbacks {
  /** Connected MCP client used to proxy the widget's `tools/call` and `resources/*` requests. */
  client: Client;
  /** The iframe the widget HTML is loaded into (must already be in the DOM, `srcdoc` unset). */
  iframe: HTMLIFrameElement;
  /** Self-contained widget HTML (from `resources/read`). */
  html: string;
  /** Tool id that produced the result being visualized. */
  toolName: string;
  /** Arguments the tool was called with (delivered to the widget as `ui/tool-input`). */
  toolArgs?: Record<string, unknown>;
  /** Tool result delivered to the widget as `ui/tool-result`. */
  toolResult: McpToolResult;
  /** Initial host theme. */
  theme?: WidgetTheme;
}

/** A mounted widget host: theme control plus teardown. */
export interface WidgetHostHandle {
  /** The underlying MCP Apps host bridge (for advanced use). */
  bridge: AppBridge;
  /** Updates the host theme, notifying the widget via `ui/notifications/host-context-changed`. */
  setTheme(theme: WidgetTheme): void;
  /** Tears down the bridge and clears the iframe. */
  dispose(): Promise<void>;
}

const HOST_INFO: Implementation = { name: "McpToolTester", version: "0.1.0" };

/** Capabilities this tester advertises to widgets. */
const HOST_CAPABILITIES: McpUiHostCapabilities = {
  openLinks: {},
  downloadFile: {},
  serverTools: { listChanged: false },
  serverResources: { listChanged: false },
  logging: {},
  message: { text: {} },
  updateModelContext: { text: {} },
};

/**
 * Deep-clones a value into a plain, structured-cloneable object. Notifications are delivered to the
 * widget via `postMessage`, whose structured-clone algorithm rejects exotic objects such as the
 * reactive `Proxy` instances Vue (or other frameworks) may wrap tool arguments/results in. The tool
 * payloads are JSON data, so a JSON round-trip both strips the proxy and guarantees cloneability.
 */
function toPlain<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function initialHostContext(theme: WidgetTheme): McpUiHostContext {
  return {
    theme,
    displayMode: "inline",
    availableDisplayModes: ["inline"],
    userAgent: "McpToolTester",
    platform: "web",
  };
}

/**
 * Mounts an MCP Apps widget into an iframe and connects it to the given MCP server via the
 * official `@modelcontextprotocol/ext-apps` {@link AppBridge}. Models the full host side of the
 * protocol: the initialize handshake, tool input + result delivery, host-theme changes, size
 * reporting, external links, chat messages, logging, and proxying the widget's own `tools/call`
 * requests back to the MCP server.
 *
 * The bridge is connected *before* the HTML is written into the iframe so the widget's
 * `ui/initialize` request is never missed.
 * @param opts Mount options (client, iframe, html, tool input/result, theme, callbacks).
 */
export async function mountWidget(opts: MountWidgetOptions): Promise<WidgetHostHandle> {
  const win = opts.iframe.contentWindow;
  if (!win) throw new Error("Widget iframe has no content window.");

  const bridge = new AppBridge(opts.client, HOST_INFO, HOST_CAPABILITIES, {
    hostContext: initialHostContext(opts.theme ?? "light"),
  });

  // Deliver tool input + result as soon as the widget completes its handshake.
  bridge.addEventListener("initialized", () => {
    void (async () => {
      try {
        await bridge.sendToolInput({ arguments: toPlain(opts.toolArgs ?? {}) });
        await bridge.sendToolResult(toPlain(opts.toolResult) as unknown as CallToolResult);
        opts.onInitialized?.();
      } catch (e) {
        opts.onError?.(e instanceof Error ? e.message : String(e));
      }
    })();
  });

  bridge.addEventListener("sizechange", (size) => opts.onSizeChange?.(size));

  bridge.addEventListener("loggingmessage", (params) => {
    opts.onLog?.({ level: params.level, source: params.logger ?? "widget", data: params.data });
  });

  // View → host requests: open external links, post chat messages, update model context.
  bridge.onopenlink = ({ url }) => {
    opts.onLog?.({ level: "info", source: "ui/open-link", data: url });
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // Popup blocked — the log entry is enough for a tester.
    }
    return Promise.resolve({});
  };
  bridge.onmessage = ({ content }) => {
    opts.onLog?.({ level: "info", source: "ui/message", data: content });
    return Promise.resolve({});
  };
  bridge.onupdatemodelcontext = ({ content }) => {
    opts.onLog?.({ level: "info", source: "ui/update-model-context", data: content });
    return Promise.resolve({});
  };
  bridge.ondownloadfile = ({ contents }) => {
    opts.onLog?.({ level: "info", source: "ui/download-file", data: contents });
    return Promise.resolve({});
  };

  const transport = new PostMessageTransport(win, win);
  await bridge.connect(transport);

  // Override the auto-forwarded tools/call handler so widget-initiated calls are logged as well as
  // proxied to the MCP server — this is the "call another MCP tool" path from inside the widget.
  bridge.oncalltool = async (params: CallToolRequest["params"], extra: { signal: AbortSignal }) => {
    opts.onCallTool?.(params.name, params.arguments);
    opts.onLog?.({ level: "info", source: "tools/call", data: { name: params.name, arguments: params.arguments } });
    const result = (await opts.client.callTool(params, undefined, { signal: extra.signal })) as CallToolResult;
    opts.onLog?.({ level: "info", source: "tools/call ✓", data: { name: params.name, isError: result.isError ?? false } });
    return result;
  };

  // Writing srcdoc last kicks off the widget, which now finds the bridge already listening.
  opts.iframe.srcdoc = opts.html;

  return {
    bridge,
    setTheme(theme: WidgetTheme) {
      bridge.setHostContext({ theme });
    },
    async dispose() {
      try {
        await bridge.close();
      } catch {
        // Already torn down.
      }
    },
  };
}
