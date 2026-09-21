// Dev entry (index.html / `vite dev`): mounts the same app the library exports.
import { mountPluginDocs } from "./mount.ts";

mountPluginDocs(document.getElementById("app")!);
