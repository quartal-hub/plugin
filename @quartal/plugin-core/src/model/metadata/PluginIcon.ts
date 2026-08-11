/** Icon entry in the `qrtl.config` `style.icons` (MCP icon schema; `src` is fetched and served from this server). */
export interface PluginIcon {
  /** Source URI (HTTP/HTTPS or data URI). Cached and exposed at `/icons/{index}` on this deployment. */
  src: string;
  /** MIME type of the icon (e.g. `image/png`, `image/svg+xml`). */
  mimeType?: string;
  /** Available pixel sizes, in CSS `<w>x<h>` form (e.g. `["128x128", "512x512"]`). */
  sizes?: string[];
  /** Variant the icon is intended for; the host picks based on its current theme. */
  theme?: "light" | "dark";
}
