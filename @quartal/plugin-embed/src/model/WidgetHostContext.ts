/** Color theme the host reports to the widget. */
export type WidgetTheme = "light" | "dark";

/** How the host lays out the widget: in the page flow, over the whole page, or picture-in-picture. */
export type WidgetDisplayMode = "inline" | "fullscreen" | "pip";

/**
 * What the host tells the widget about its environment (MCP Apps `McpUiHostContext`). Only the
 * fields a web page host sets are typed; any other context field passes through to the widget.
 */
export interface WidgetHostContext {
  /** Current color theme. */
  theme?: WidgetTheme;
  /** Current display mode. */
  displayMode?: WidgetDisplayMode;
  /** Display modes the host can switch to. */
  availableDisplayModes?: WidgetDisplayMode[];
  /** User's language and region (BCP 47). */
  locale?: string;
  /** User's time zone (IANA). */
  timeZone?: string;
  /** Host application identifier. */
  userAgent?: string;
  /** Platform type. */
  platform?: "web" | "desktop" | "mobile";
  /**
   * Room the host gives the widget: a fixed `height`/`width`, or a `maxHeight`/`maxWidth` the
   * widget may grow to (it scrolls inside itself beyond that).
   */
  containerDimensions?: { height?: number; maxHeight?: number; width?: number; maxWidth?: number };
  /** Theme variables and fonts for the widget (`McpUiHostStyles`). */
  styles?: { variables?: Record<string, string | undefined>; css?: { fonts?: string } };
  [key: string]: unknown;
}
