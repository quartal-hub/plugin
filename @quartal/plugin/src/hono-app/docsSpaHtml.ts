/** Default Bootstrap skin when the manifest omits `style.skin`. */
export const DEFAULT_DOCS_SKIN_URL = "https://cdn.quartal.com/skins/default.css";

const SKIN_LINK_ID = "plugin-docs-web-skin";

function escapeHtmlAttr(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function escapeHtmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Suffix of every plugin docs page title: `Auth Agent - Quartal Plugin`. */
export const DOCS_TITLE_SUFFIX = "Quartal Plugin";

/**
 * Sets the docs page `<title>` to the plugin's title, e.g. `Auth Agent - Quartal Plugin`, so a
 * browser tab, bookmark or history entry names the plugin rather than the shared shell.
 * @param html The docs SPA index.html.
 * @param pluginTitle The plugin's title (`qrtl.config` `title`, or derived from its name).
 */
export function injectDocsSpaTitle(html: string, pluginTitle: string | undefined): string {
  const name = pluginTitle?.trim();
  const titleTag = `<title>${escapeHtmlText(name ? `${name} - ${DOCS_TITLE_SUFFIX}` : DOCS_TITLE_SUFFIX)}</title>`;
  if (/<title[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, () => titleTag);
  }
  return html.replace("</head>", `    ${titleTag}\n  </head>`);
}

function skinLinkTag(skinUrl: string): string {
  return `<link rel="stylesheet" id="${SKIN_LINK_ID}" href="${escapeHtmlAttr(skinUrl)}" />`;
}

/**
 * Injects the plugin skin into the vendored docs SPA shell so CSS loads before the app mounts.
 * Expects a `<link id="plugin-docs-web-skin" …>` placeholder from the plugin-docs-web build.
 * @param html The docs SPA index.html.
 * @param skinUrl The Bootstrap skin URL to inject.
 */
export function injectDocsSpaSkin(html: string, skinUrl: string): string {
  const url = skinUrl.trim() || DEFAULT_DOCS_SKIN_URL;
  const tagged = html.match(new RegExp(`<link[^>]*id="${SKIN_LINK_ID}"[^>]*>`, "i"));
  if (tagged) {
    return html.replace(tagged[0], skinLinkTag(url));
  }

  // Older vendored builds: replace the first CDN skin link (not the Vite bundle CSS).
  const legacy = html.match(/<link rel="stylesheet" href="https?:\/\/[^"]+"\s*\/?>/i);
  if (legacy) {
    return html.replace(legacy[0], skinLinkTag(url));
  }

  return html.replace("</head>", `    ${skinLinkTag(url)}\n  </head>`);
}
