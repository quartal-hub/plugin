/** Domains the host should allow in the iframe CSP for this widget. */
export interface WidgetCsp {
  /** Domains allowed for `connect-src` (fetch, WebSocket, etc.). */
  connectDomains?: string[];
  /** Domains allowed for scripts, styles, images, and other subresources. */
  resourceDomains?: string[];
  /** Domains allowed for nested iframes (`frame-src`). */
  frameDomains?: string[];
  /** Domains allowed for document base URIs. */
  baseUriDomains?: string[];
}

/** Catalog-side summary of a registered widget — cheap to compute (no HTML read). */
export interface WidgetCatalogEntry {
  /** Tool id the widget visualizes. */
  toolId: string;
  /** Display name (from the `qrtl.config` `widgets` section), falling back to the tool id. */
  name: string;
}
