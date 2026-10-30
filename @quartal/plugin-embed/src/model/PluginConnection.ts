import type { CallToolResult } from "./CallToolResult.ts";
import type { WidgetRoutes } from "./ToolRoute.ts";
import type { WidgetCallbacks } from "./WidgetEvents.ts";
import type { WidgetHostContext, WidgetTheme } from "./WidgetHostContext.ts";

/** Returns the bearer token for the plugin's API, or nothing for an anonymous call. */
export type TokenProvider = () => string | null | undefined | Promise<string | null | undefined>;

/** How a call authenticates: a fixed bearer token, or a function that returns a fresh one. */
export interface PluginAuth {
  /** Bearer token sent as `Authorization: Bearer <token>`. */
  token?: string | null;
  /** Called before every request; wins over {@link PluginAuth.token}. */
  getToken?: TokenProvider;
}

/** Options for `connectPlugin`. */
export interface ConnectPluginOptions extends PluginAuth {
  /** The plugin's origin, e.g. `https://salaxy-anon.vercel.app`. */
  url: string;
  /** The route table; fetched from `<url>/widgets/routes.json` on first use when omitted. */
  routes?: WidgetRoutes;
  /** `fetch` implementation. Default: the global `fetch`. */
  fetch?: typeof fetch;
}

/** Per-call options. */
export interface CallToolOptions extends PluginAuth {
  /** Aborts the request. */
  signal?: AbortSignal;
}

/** Options for mounting a widget. */
export interface MountWidgetOptions extends WidgetCallbacks, PluginAuth {
  /** Id of the tool whose widget to show. */
  tool: string;
  /**
   * The tool's input. Without {@link MountWidgetOptions.result} the tool is called with it and the
   * widget gets the result. With neither, the widget waits until `update()` gives it one.
   */
  args?: Record<string, unknown>;
  /** A result the page already has: shown as is, without calling the tool. */
  result?: unknown;
  /** Color theme. Default `light`. */
  theme?: WidgetTheme;
  /** More host context for the widget (locale, display modes, styles). */
  hostContext?: WidgetHostContext;
  /** Called with the JSON result the widget shows, each time it gets one. */
  onResult?: (value: unknown) => void;
  /** Size the iframe height to the widget's content. Default `true`. */
  autoResize?: boolean;
  /** `title` attribute of the iframe. Default: the widget title. */
  title?: string;
}

/** A widget mounted into a page. */
export interface MountedWidget {
  /** The iframe the widget runs in. */
  readonly iframe: HTMLIFrameElement;
  /** Resolves when the widget completes its handshake. */
  readonly ready: Promise<void>;
  /**
   * Changes the input or the result. New `args` without a `result` call the tool again; a `result`
   * is shown as is.
   */
  update(change: { args?: Record<string, unknown>; result?: unknown }): void;
  /** Changes the color theme. */
  setTheme(theme: WidgetTheme): void;
  /** Merges a change into the host context. */
  setHostContext(change: WidgetHostContext): void;
  /** Stops the host and removes the iframe. */
  dispose(): Promise<void>;
}

/** A connection to one plugin: its REST tools and its widgets. */
export interface PluginConnection {
  /** The plugin origin. */
  readonly url: string;
  /** The route table (fetched once). */
  routes(): Promise<WidgetRoutes>;
  /** Changes the auth used by later calls. */
  setAuth(auth: PluginAuth): void;
  /**
   * Calls a tool over REST and returns its JSON result. Rejects with a `PluginToolError` when the
   * plugin answers with an error status.
   * @param name Tool id.
   * @param args The tool's input object.
   */
  callTool<T = unknown>(name: string, args?: Record<string, unknown>, options?: CallToolOptions): Promise<T>;
  /** Like `callTool`, but answers with an MCP `CallToolResult` (errors as `isError`) instead of throwing. */
  callToolResult(name: string, args?: Record<string, unknown>, options?: CallToolOptions): Promise<CallToolResult>;
  /** Absolute URL of a tool's widget page. */
  widgetUrl(tool: string): Promise<string>;
  /**
   * Shows a tool's widget in an iframe appended to `container`. The widget's own tool calls go to
   * `onToolCall` first, then to the plugin's REST API with this connection's auth.
   */
  mountWidget(container: Element, options: MountWidgetOptions): MountedWidget;
}
