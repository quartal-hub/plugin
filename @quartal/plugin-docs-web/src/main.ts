// docsAuth first: it captures the OAuth callback's `#access_token`/`#auth_error` fragment, which
// the router's hash history would otherwise normalize away before the module evaluates.
import "./lib/docsAuth.ts";
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router.ts";
import "../../ui-plugin/src/styles/ui-plugin.css";

createApp(App).use(router).mount("#app");
