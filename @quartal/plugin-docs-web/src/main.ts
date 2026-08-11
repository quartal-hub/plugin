import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router.ts";
import "../../ui-plugin/src/styles/ui-plugin.css";

createApp(App).use(router).mount("#app");
