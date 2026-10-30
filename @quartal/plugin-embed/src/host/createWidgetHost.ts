import type {
  CallToolResult,
  ContentBlock,
  WidgetCallbacks,
  WidgetDisplayMode,
  WidgetHostContext,
  WidgetTheme,
  WidgetToolResult,
} from "../model/index.ts";
import { errorToolResult, jsonToolResult, readToolResult } from "./toolResults.ts";

/** MCP Apps protocol versions this host speaks, newest first. */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2026-01-26", "2025-11-21"] as const;

/** Options for {@link createWidgetHost}. */
export interface WidgetHostOptions extends WidgetCallbacks {
  /** The iframe the widget runs in. It must be in the document. */
  iframe: HTMLIFrameElement;
  /** URL of the widget page; the host loads it into the iframe and accepts messages only from its origin. */
  src?: string;
  /** Widget HTML (an MCP `ui://` resource); the host writes it into the iframe's `srcdoc`. */
  html?: string;
  /**
   * Origin the widget's messages must come from. Default: the origin of `src`, or any origin for
   * `html` (messages must still come from the iframe's own window).
   */
  origin?: string;
  /** Id of the tool the widget shows. */
  toolName: string;
  /** The tool's input, delivered as `ui/notifications/tool-input`. */
  toolInput?: Record<string, unknown>;
  /** The tool's result, delivered as `ui/notifications/tool-result` once the widget is ready. */
  toolResult?: CallToolResult;
  /**
   * Runs a tool the widget calls (after `onToolCall` let it through). Without it the widget's tool
   * calls fail with an error result.
   */
  callTool?: (name: string, args: Record<string, unknown>, options: { signal: AbortSignal }) => Promise<CallToolResult>;
  /** Initial host context (theme, display modes, locale, …). */
  hostContext?: WidgetHostContext;
  /** Host name and version reported in the handshake. */
  hostInfo?: { name: string; version: string };
  /** Size the iframe height to the widget's content. Default `true`. */
  autoResize?: boolean;
}

/** A running widget host. */
export interface WidgetHost {
  /** Resolves when the widget completes its handshake. */
  readonly ready: Promise<void>;
  /** The current host context. */
  readonly hostContext: WidgetHostContext;
  /** Sends the tool input (and keeps it for a widget that reloads). */
  sendToolInput(args: Record<string, unknown>): void;
  /** Sends the tool result (and keeps it for a widget that reloads). */
  sendToolResult(result: CallToolResult): void;
  /** Tells the widget the tool run was cancelled. */
  sendToolCancelled(reason?: string): void;
  /** Merges a change into the host context and notifies the widget. */
  setHostContext(change: WidgetHostContext): void;
  /** Shorthand for `setHostContext({ theme })`. */
  setTheme(theme: WidgetTheme): void;
  /** Asks the widget to clean up, then stops listening. The iframe stays where it is. */
  dispose(): Promise<void>;
}

type JsonRpcId = string | number;

interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

class RpcError extends Error {
  constructor(public readonly code: number, message: string) {
    super(message);
  }
}

const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

/** How long `dispose()` waits for the widget to acknowledge `ui/resource-teardown`. */
const TEARDOWN_TIMEOUT_MS = 500;

/**
 * Copies a value into plain JSON data. `postMessage` structured-clones its payload and rejects
 * exotic objects such as the reactive proxies Vue wraps arguments in; tool payloads are JSON, so a
 * JSON round trip strips them and guarantees the payload can be cloned.
 */
function toPlain<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultHostContext(hostName: string): WidgetHostContext {
  const context: WidgetHostContext = {
    theme: "light",
    displayMode: "inline",
    availableDisplayModes: ["inline"],
    platform: "web",
    userAgent: hostName,
  };
  if (typeof navigator !== "undefined" && navigator.language) context.locale = navigator.language;
  try {
    context.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // No Intl time zone support.
  }
  return context;
}

/**
 * Runs the host side of the MCP Apps protocol for one widget iframe: answers the widget's
 * `ui/initialize`, delivers the tool input and result, pushes host-context changes, and handles the
 * widget's requests — tool calls (through `onToolCall`, then `callTool`), links, chat messages,
 * model context, display modes and size changes.
 *
 * Messages are accepted only from the iframe's own window (and, for `src`, from its origin). The
 * listener is attached before the page is loaded, so the widget's first request is never missed.
 * @param options The iframe, what to load into it, the tool data and the callbacks.
 */
export function createWidgetHost(options: WidgetHostOptions): WidgetHost {
  const { iframe } = options;
  const hostWindow = iframe.ownerDocument.defaultView;
  if (!hostWindow) throw new Error("The widget iframe must be in a document with a window.");
  const hostInfo = options.hostInfo ?? { name: "QuartalPluginEmbed", version: "1.0.0" };
  const expectedOrigin = options.origin
    ?? (options.src !== undefined ? new URL(options.src, hostWindow.location.href).origin : "*");
  const targetOrigin = expectedOrigin === "null" ? "*" : expectedOrigin;

  let hostContext: WidgetHostContext = { ...defaultHostContext(hostInfo.name), ...options.hostContext };
  let toolInput = options.toolInput;
  let toolResult = options.toolResult;
  let initialized = false;
  /** The context sent in the last `ui/initialize` answer; changes made before `initialized` are sent after it. */
  let contextAtInitialize: WidgetHostContext | null = null;
  let disposed = false;
  let nextId = 1;
  const pending = new Map<JsonRpcId, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  const inFlight = new Map<JsonRpcId, AbortController>();

  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const post = (message: JsonRpcMessage): void => {
    if (disposed) return;
    iframe.contentWindow?.postMessage(message, targetOrigin);
  };
  const notify = (method: string, params?: Record<string, unknown>): void => {
    post({ jsonrpc: "2.0", method, ...(params ? { params: toPlain(params) } : {}) });
  };
  const request = (method: string, params: Record<string, unknown>, timeoutMs: number): Promise<unknown> => {
    const id = `host-${nextId++}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, timeoutMs);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      post({ jsonrpc: "2.0", id, method, params });
    });
  };

  const log = (source: string, data: unknown, level = "info"): void => {
    options.onLog?.({ level, source, data });
  };

  const reportResult = (result: CallToolResult): void => {
    const { error } = readToolResult(result);
    if (error !== undefined) options.onError?.(error);
  };

  const deliverToolData = (): void => {
    if (toolInput !== undefined) notify("ui/notifications/tool-input", { arguments: toolInput });
    if (toolResult !== undefined) {
      notify("ui/notifications/tool-result", toolResult);
      reportResult(toolResult);
    }
  };

  const runToolCall = async (id: JsonRpcId, params: Record<string, unknown>): Promise<CallToolResult> => {
    const name = params.name;
    if (typeof name !== "string") throw new RpcError(INVALID_PARAMS, "tools/call needs a tool name.");
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    log("tools/call", { name, arguments: args });
    const controller = new AbortController();
    inFlight.set(id, controller);
    let result: CallToolResult;
    try {
      const answer = options.onToolCall ? await options.onToolCall({ name, args }) : undefined;
      if (answer !== undefined) {
        result = jsonToolResult(answer);
      } else if (options.callTool) {
        result = await options.callTool(name, args, { signal: controller.signal });
      } else {
        result = errorToolResult(`Tool "${name}" is not available here.`);
      }
    } catch (error) {
      result = errorToolResult(error instanceof Error ? error.message : String(error));
    } finally {
      inFlight.delete(id);
    }
    const read = readToolResult(result);
    const event: WidgetToolResult = { name, args, result, ...read };
    log("tools/call result", { name, isError: result.isError ?? false });
    options.onToolResult?.(event);
    return result;
  };

  const grantDisplayMode = async (mode: WidgetDisplayMode): Promise<WidgetDisplayMode> => {
    const current = hostContext.displayMode ?? "inline";
    const granted = options.onDisplayMode
      ? await options.onDisplayMode(mode, hostContext)
      : (hostContext.availableDisplayModes ?? ["inline"]).includes(mode) ? mode : current;
    if (granted !== current) setHostContext({ displayMode: granted });
    return granted;
  };

  const handleRequest = async (method: string, id: JsonRpcId, params: Record<string, unknown>): Promise<unknown> => {
    switch (method) {
      case "ui/initialize": {
        const requested = params.protocolVersion;
        const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested as never)
          ? (requested as string)
          : SUPPORTED_PROTOCOL_VERSIONS[0];
        return {
          protocolVersion,
          hostInfo,
          hostCapabilities: {
            openLinks: {},
            serverTools: { listChanged: false },
            logging: {},
            message: { text: {} },
            updateModelContext: { text: {}, structuredContent: {} },
          },
          hostContext: toPlain((contextAtInitialize = hostContext)),
        };
      }
      case "ping":
        return {};
      case "tools/call":
        return runToolCall(id, params);
      case "ui/open-link": {
        const url = params.url;
        if (typeof url !== "string") throw new RpcError(INVALID_PARAMS, "ui/open-link needs a url.");
        log("ui/open-link", url);
        if (options.onOpenLink) {
          await options.onOpenLink(url);
          return {};
        }
        const opened = hostWindow.open(url, "_blank", "noopener,noreferrer");
        return opened === null ? { isError: true } : {};
      }
      case "ui/message": {
        log("ui/message", params.content);
        await options.onMessage?.({ role: String(params.role ?? "user"), content: (params.content ?? []) as ContentBlock[] });
        return {};
      }
      case "ui/update-model-context": {
        log("ui/update-model-context", params);
        await options.onModelContext?.({
          ...(params.content ? { content: params.content as ContentBlock[] } : {}),
          ...(params.structuredContent ? { structuredContent: params.structuredContent as Record<string, unknown> } : {}),
        });
        return {};
      }
      case "ui/request-display-mode":
        return { mode: await grantDisplayMode(params.mode as WidgetDisplayMode) };
      default:
        throw new RpcError(METHOD_NOT_FOUND, `Method not supported by this host: ${method}`);
    }
  };

  const handleNotification = (method: string, params: Record<string, unknown>): void => {
    switch (method) {
      case "ui/notifications/initialized":
        initialized = true;
        if (contextAtInitialize && contextAtInitialize !== hostContext) {
          notify("ui/notifications/host-context-changed", hostContext);
        }
        deliverToolData();
        resolveReady();
        options.onReady?.();
        return;
      case "ui/notifications/size-changed": {
        const width = typeof params.width === "number" ? params.width : undefined;
        const height = typeof params.height === "number" ? params.height : undefined;
        if (options.autoResize !== false && height !== undefined && height > 0) {
          iframe.style.height = `${Math.ceil(height)}px`;
        }
        options.onSize?.({ width, height });
        return;
      }
      case "notifications/message":
        options.onLog?.({
          level: String(params.level ?? "info"),
          source: typeof params.logger === "string" ? params.logger : "widget",
          data: params.data,
        });
        return;
      case "notifications/cancelled":
        inFlight.get(params.requestId as JsonRpcId)?.abort();
        return;
      default:
        log(method, params, "debug");
    }
  };

  const onMessage = (event: MessageEvent): void => {
    if (disposed || event.source !== iframe.contentWindow) return;
    if (expectedOrigin !== "*" && event.origin !== expectedOrigin) return;
    const message = event.data as JsonRpcMessage | null;
    if (!message || typeof message !== "object" || message.jsonrpc !== "2.0") return;

    if (message.method === undefined) {
      // A response to one of the host's own requests.
      const waiter = message.id !== undefined ? pending.get(message.id) : undefined;
      if (!waiter) return;
      pending.delete(message.id!);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
      return;
    }

    const params = message.params ?? {};
    if (message.id === undefined) {
      handleNotification(message.method, params);
      return;
    }
    const id = message.id;
    handleRequest(message.method, id, params).then(
      (result) => post({ jsonrpc: "2.0", id, result: toPlain(result) }),
      (error: unknown) => {
        const code = error instanceof RpcError ? error.code : INTERNAL_ERROR;
        const text = error instanceof Error ? error.message : String(error);
        post({ jsonrpc: "2.0", id, error: { code, message: text } });
      },
    );
  };

  function setHostContext(change: WidgetHostContext): void {
    hostContext = { ...hostContext, ...change };
    if (initialized) notify("ui/notifications/host-context-changed", change);
  }

  hostWindow.addEventListener("message", onMessage);
  if (options.html !== undefined) iframe.srcdoc = options.html;
  else if (options.src !== undefined) iframe.src = options.src;

  return {
    ready,
    get hostContext() {
      return hostContext;
    },
    sendToolInput(args) {
      toolInput = args;
      if (initialized) notify("ui/notifications/tool-input", { arguments: args });
    },
    sendToolResult(result) {
      toolResult = result;
      if (!initialized) return;
      notify("ui/notifications/tool-result", result);
      reportResult(result);
    },
    sendToolCancelled(reason) {
      if (initialized) notify("ui/notifications/tool-cancelled", reason ? { reason } : {});
    },
    setHostContext,
    setTheme(theme) {
      setHostContext({ theme });
    },
    async dispose() {
      if (disposed) return;
      if (initialized) {
        try {
          await request("ui/resource-teardown", {}, TEARDOWN_TIMEOUT_MS);
        } catch {
          // The widget did not answer in time; tear down anyway.
        }
      }
      disposed = true;
      hostWindow.removeEventListener("message", onMessage);
      for (const controller of inFlight.values()) controller.abort();
      for (const waiter of pending.values()) waiter.reject(new Error("Widget host disposed."));
      pending.clear();
    },
  };
}
