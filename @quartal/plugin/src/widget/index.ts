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
  /** Called with a human-readable message when a tool result cannot be parsed. */
  onError?: (message: string) => void;
  /** Called with the host theme on connect and whenever it changes. */
  onTheme?: (theme: WidgetTheme) => void;
}

/** A connected widget: current state plus the underlying {@link App} for advanced host calls. */
export interface WidgetBridge<TResult = unknown> {
  /** Latest parsed tool result, or `null` before the first result arrives. */
  result: TResult | null;
  /** Latest parse error message, or `null`. */
  error: string | null;
  /** Current host theme. */
  theme: WidgetTheme;
  /** The underlying `@modelcontextprotocol/ext-apps` app (e.g. for `callServerTool`, `sendMessage`). */
  app: App;
}

/** Extracts the first text content block from a tool-result notification, if present. */
function firstTextContent(content: ReadonlyArray<unknown> | undefined): string | undefined {
  const first = content?.[0];
  if (first && typeof first === "object" && "text" in first) {
    const text = (first as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  return undefined;
}

/**
 * Connects a widget to its MCP host and returns a live {@link WidgetBridge}. Subscribes to tool results
 * (JSON-parsed from the first text content block, optionally `parse`d) and host-context changes, applies
 * the host theme to the document, and resolves once the `ui/initialize` handshake completes.
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

  app.ontoolresult = (params) => {
    const text = firstTextContent(params.content);
    if (text === undefined) return;
    try {
      const raw: unknown = JSON.parse(text);
      const value = (options.parse ? options.parse(raw) : raw) as TResult;
      bridge.result = value;
      bridge.error = null;
      options.onResult?.(value);
    } catch (error) {
      bridge.error = error instanceof Error ? error.message : String(error);
      options.onError?.(bridge.error);
    }
  };

  app.onhostcontextchanged = (ctx) => {
    setTheme(ctx?.theme === "dark" ? "dark" : "light");
  };

  await app.connect();
  setTheme(app.getHostContext()?.theme === "dark" ? "dark" : "light");
  return bridge;
}

export { App, applyDocumentTheme } from "@modelcontextprotocol/ext-apps";
