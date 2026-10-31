import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  type CallToolResult,
  createWidgetHost,
  type WidgetHost,
  type WidgetLogEntry,
  type WidgetTheme,
} from "@quartal/plugin-embed";
import type { McpToolResult } from "./mcpToolTester.ts";

export type { WidgetLogEntry, WidgetTheme };

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
  /** Fired when the tool result holds an error, or for an unrecoverable host error. */
  onError?: (message: string) => void;
}

/** Options for {@link mountMcpWidget}. */
export interface MountMcpWidgetOptions extends WidgetHostCallbacks {
  /** Connected MCP client the widget's own `tools/call` requests go through. */
  client: Client;
  /** The iframe the widget HTML is loaded into (must already be in the DOM). */
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
  /** The underlying MCP Apps host (for advanced use). */
  host: WidgetHost;
  /** Updates the host theme, notifying the widget via `ui/notifications/host-context-changed`. */
  setTheme(theme: WidgetTheme): void;
  /** Tears down the host. */
  dispose(): Promise<void>;
}

/**
 * Mounts an MCP Apps widget into an iframe and connects it to an MCP server: the widget HTML goes
 * into `srcdoc`, the tool input and result are delivered after the handshake, and the widget's own
 * `tools/call` requests are proxied to the server through `client`. Links open in a new tab; chat
 * messages, model-context updates and logs are reported through `onLog`.
 * @param opts Mount options (client, iframe, html, tool input/result, theme, callbacks).
 */
export async function mountMcpWidget(opts: MountMcpWidgetOptions): Promise<WidgetHostHandle> {
  const host = createWidgetHost({
    iframe: opts.iframe,
    html: opts.html,
    toolName: opts.toolName,
    toolInput: opts.toolArgs ?? {},
    toolResult: opts.toolResult as CallToolResult,
    hostContext: { theme: opts.theme ?? "light" },
    hostInfo: { name: "McpToolTester", version: "0.1.0" },
    autoResize: false,
    onReady: () => opts.onInitialized?.(),
    onSize: (size) => opts.onSizeChange?.(size),
    onLog: (entry) => opts.onLog?.(entry),
    onError: (message) => opts.onError?.(message),
    onToolCall: ({ name, args }) => {
      opts.onCallTool?.(name, args);
      return undefined;
    },
    callTool: async (name, args, { signal }) =>
      (await opts.client.callTool({ name, arguments: args }, undefined, { signal })) as CallToolResult,
  });

  return {
    host,
    setTheme(theme: WidgetTheme) {
      host.setTheme(theme);
    },
    dispose: () => host.dispose(),
  };
}
