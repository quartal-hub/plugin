import type { CallToolResult, ContentBlock } from "./CallToolResult.ts";
import type { WidgetDisplayMode, WidgetHostContext } from "./WidgetHostContext.ts";

/** A tool call the widget makes (`tools/call`). */
export interface WidgetToolCall {
  /** Tool id. */
  name: string;
  /** The tool's input object. */
  args: Record<string, unknown>;
}

/** The outcome of a tool call the widget made. */
export interface WidgetToolResult extends WidgetToolCall {
  /** The result returned to the widget. */
  result: CallToolResult;
  /** The JSON result, when the call succeeded. */
  value?: unknown;
  /** The error message, when the call failed. */
  error?: string;
}

/** A message the widget asks the host to add to the conversation (`ui/message`). */
export interface WidgetMessage {
  /** Message role (`user`). */
  role: string;
  /** Message content. */
  content: ContentBlock[];
}

/** Context the widget hands to the host for the model's next turn (`ui/update-model-context`). */
export interface WidgetModelContext {
  /** Context content blocks. */
  content?: ContentBlock[];
  /** Machine-readable context. */
  structuredContent?: Record<string, unknown>;
}

/** A log line from the widget (`notifications/message`) or the host's own activity. */
export interface WidgetLogEntry {
  /** Log level. */
  level: string;
  /** Logger name or protocol method. */
  source: string;
  /** Payload. */
  data: unknown;
}

/** The widget's content size (`ui/notifications/size-changed`). */
export interface WidgetSize {
  /** Content width in pixels. */
  width?: number;
  /** Content height in pixels. */
  height?: number;
}

/**
 * What a page can observe or decide about a mounted widget. Every callback is optional; the host
 * has a sensible default for each request the widget makes.
 */
export interface WidgetCallbacks {
  /** The widget finished its handshake and has its input (and result, when there is one). */
  onReady?: () => void;
  /**
   * The widget calls a tool. Return a value (or a promise of one) to answer the call yourself: it
   * becomes the tool's JSON result and the tool is not run. Throw to fail the call. Return nothing
   * to let the host run the tool.
   */
  onToolCall?: (call: WidgetToolCall) => unknown;
  /** A tool call the widget made completed (successfully or not). */
  onToolResult?: (result: WidgetToolResult) => void;
  /** The widget sends a chat message (`ui/message`). */
  onMessage?: (message: WidgetMessage) => void | Promise<void>;
  /** The widget updates the model context (`ui/update-model-context`). */
  onModelContext?: (context: WidgetModelContext) => void | Promise<void>;
  /** The widget asks to open a link. Default: `window.open` in a new tab. */
  onOpenLink?: (url: string) => void | Promise<void>;
  /**
   * The widget asks for another display mode. Return the mode you set; by default a mode listed in
   * the host context's `availableDisplayModes` is granted and anything else is refused.
   */
  onDisplayMode?: (mode: WidgetDisplayMode, context: WidgetHostContext) => WidgetDisplayMode | Promise<WidgetDisplayMode>;
  /** The widget reports its content size. The iframe height follows it unless `autoResize` is `false`. */
  onSize?: (size: WidgetSize) => void;
  /** A log line from the widget, or host activity worth logging. */
  onLog?: (entry: WidgetLogEntry) => void;
  /** The tool result delivered to the widget holds an error, or the host failed. */
  onError?: (message: string) => void;
}
