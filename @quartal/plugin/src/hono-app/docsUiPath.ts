import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

/**
 * Directory URL for the vendored `plugin-docs-web` build output (`index.html`, `assets/`).
 *
 * Resolves the `@quartal/plugin` package first so the path survives bundling into a consumer's server
 * output (e.g. `@astrojs/node`), where `import.meta.url` no longer points inside this plugin and a
 * naive relative URL would look under the *consumer's* root. Falls back to the `import.meta.url`-relative
 * path for unbundled/dev use.
 */
export function getPkgDocsWebStaticRoot(): URL {
  try {
    const entry = createRequire(import.meta.url).resolve("@quartal/plugin"); // .../@quartal/plugin/dist/index.js
    return new URL("../static/plugin-docs-web/", pathToFileURL(entry));
  } catch {
    return new URL("../../static/plugin-docs-web/", import.meta.url);
  }
}
