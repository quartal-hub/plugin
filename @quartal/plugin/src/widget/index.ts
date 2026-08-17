/**
 * `@quartal/plugin/widget` — the browser-side MCP Apps bridge for Quartal Plugin widgets.
 *
 * A framework-agnostic port of the old `salaxy-anon/vue/src/lib/useExtApps.ts`: it wraps
 * `@modelcontextprotocol/ext-apps`'s {@link App}, connects to the host, exposes the latest tool result
 * and host theme, and mirrors the theme onto the document. Call it from an island in any framework
 * (Vue/React/Svelte/vanilla) — the returned bridge is a plain object plus callbacks, so each framework
 * can wrap it in its own idiom (a Vue composable, a React hook, …).
 * @module
 */
import { App, applyDocumentTheme } from "@modelcontextprotocol/ext-apps";

/** Host theme reported by the MCP client. */
export type WidgetTheme = "light" | "dark";

/** Options for {@link connectWidget}. */
export interface ConnectWidgetOptions<TResult = unknown> {
  /** App name reported to the host in the `ui/initialize` handshake. */
  name: string;
  /** App version reported to the host. Default `"0.0.0"`. */
  version?: string;
  /** Auto-report iframe size changes to the host via `ResizeObserver`. Default `true`. */
  autoResize?: boolean;
  /** Transform the parsed JSON tool result into the widget's payload type. */
  parse?: (raw: unknown) => TResult;
  /** Apply the host theme to `<html data-theme>` (via the SDK's `applyDocumentTheme`). Default `true`. */
  applyTheme?: boolean;
  /** Called with the parsed tool result each time the host delivers one. */
  onResult?: (result: TResult) => void;
  /**
   * Called with a human-readable message when the tool reports an execution error (`isError: true`),
   * the tool run is cancelled by the host, or a tool result cannot be parsed.
   */
  onError?: (message: string) => void;
  /** Called with the host theme on connect and whenever it changes. */
  onTheme?: (theme: WidgetTheme) => void;
}

/** A connected widget: current state plus the underlying {@link App} for advanced host calls. */
export interface WidgetBridge<TResult = unknown> {
  /** Latest parsed tool result, or `null` before the first result arrives. */
  result: TResult | null;
  /** Latest error message (tool execution error, cancellation, or parse failure), or `null`. */
  error: string | null;
  /** Current host theme. */
  theme: WidgetTheme;
  /** The underlying `@modelcontextprotocol/ext-apps` app (e.g. for `callServerTool`, `sendMessage`). */
  app: App;
}

/** The slice of the MCP `CallToolResult` the bridge reads from a tool-result notification. */
interface ToolResultLike {
  content?: ReadonlyArray<unknown>;
  structuredContent?: unknown;
  isError?: boolean;
}

/** Extracts the first `type: "text"` content block from tool-result content, wherever it sits. */
function firstTextContent(content: ReadonlyArray<unknown> | undefined): string | undefined {
  for (const block of content ?? []) {
    if (block && typeof block === "object" && (block as { type?: unknown }).type === "text") {
      const text = (block as { text?: unknown }).text;
      if (typeof text === "string") return text;
    }
  }
  return undefined;
}

/**
 * Extracts an error message from an error-shaped value: an `{ error: string }` object (with no
 * other keys), as produced by the plugin REST API and by older Quartal MCP servers that reported
 * execution errors without `isError: true`.
 */
function errorShapedMessage(raw: unknown): string | undefined {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length === 1 && keys[0] === "error" && typeof record.error === "string") {
      return record.error;
    }
  }
  return undefined;
}

/** Best human-readable message for an `isError: true` result: unwraps a JSON `{ error }` text block. */
function executionErrorMessage(content: ReadonlyArray<unknown> | undefined): string {
  const text = firstTextContent(content);
  if (text === undefined) return "Tool execution failed.";
  try {
    return errorShapedMessage(JSON.parse(text)) ?? text;
  } catch {
    return text;
  }
}

/**
 * Connects a widget to its MCP host and returns a live {@link WidgetBridge}. Subscribes to tool
 * results and host-context changes, applies the host theme to the document, and resolves once the
 * `ui/initialize` handshake completes.
 *
 * Tool results are read `structuredContent`-first, falling back to the first `type: "text"` content
 * block (JSON-parsed) for servers that do not return structured content. Errors — a result with
 * `isError: true`, a host-side cancellation, an error-shaped legacy payload, or a parse failure —
 * set {@link WidgetBridge.error} and fire `onError` instead of touching the last good result.
 * @param options Bridge options (name/version, parse transform, callbacks, theme handling).
 */
export async function connectWidget<TResult = unknown>(
  options: ConnectWidgetOptions<TResult>,
): Promise<WidgetBridge<TResult>> {
  const app = new App(
    { name: options.name, version: options.version ?? "0.0.0" },
    {},
    { autoResize: options.autoResize ?? true },
  );

  const bridge: WidgetBridge<TResult> = { result: null, error: null, theme: "light", app };

  const setTheme = (theme: WidgetTheme): void => {
    bridge.theme = theme;
    if (options.applyTheme !== false) applyDocumentTheme(theme);
    options.onTheme?.(theme);
  };

  const setError = (message: string): void => {
    bridge.error = message;
    options.onError?.(message);
  };

  app.addEventListener("toolresult", (params: ToolResultLike) => {
    // Tool execution error (MCP spec): the result carries `isError: true` and the error in content.
    if (params.isError) {
      setError(executionErrorMessage(params.content));
      return;
    }

    // Prefer `structuredContent`; fall back to the first text content block (JSON-parsed) for
    // servers that do not return structured content.
    let raw: unknown;
    if (params.structuredContent !== undefined) {
      raw = params.structuredContent;
    } else {
      const text = firstTextContent(params.content);
      if (text === undefined) return;
      try {
        raw = JSON.parse(text);
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
        return;
      }
    }

    // Older Quartal servers reported execution errors as a plain `{ error }` result without
    // `isError` — surface those as errors too, not as results.
    const legacyError = errorShapedMessage(raw);
    if (legacyError !== undefined) {
      setError(legacyError);
      return;
    }

    try {
      const value = (options.parse ? options.parse(raw) : raw) as TResult;
      bridge.result = value;
      bridge.error = null;
      options.onResult?.(value);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  });

  app.addEventListener("toolcancelled", (params: { reason?: string }) => {
    setError(params.reason ? `Tool execution cancelled: ${params.reason}` : "Tool execution cancelled.");
  });

  app.addEventListener("hostcontextchanged", (ctx: { theme?: unknown } | undefined) => {
    setTheme(ctx?.theme === "dark" ? "dark" : "light");
  });

  await app.connect();
  setTheme(app.getHostContext()?.theme === "dark" ? "dark" : "light");
  return bridge;
}

export { App, applyDocumentTheme } from "@modelcontextprotocol/ext-apps";
