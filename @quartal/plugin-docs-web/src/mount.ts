// docsAuth first: it captures the OAuth callback's `#access_token`/`#auth_error` fragment, which
// the router's hash history would otherwise normalize away before the module evaluates.
import "./lib/docsAuth.ts";
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router.ts";
import "../../ui-plugin/src/styles/ui-plugin.css";

/**
 * Mounts the plugin docs UI into `el`. The library entry point: the Quartal Plugins website's
 * `/plugin-index` page calls this, and every deployed plugin serves that page's HTML at `/`
 * (see `@quartal/plugin`'s `docsShell.ts`). The app reads all plugin data from the document
 * origin, so it must run on a page served by the plugin (or the dev proxy).
 * @param el The element to mount into.
 */
export function mountPluginDocs(el: Element): void {
  createApp(App).use(router).mount(el);
}
