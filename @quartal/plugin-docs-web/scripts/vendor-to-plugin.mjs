// Copies `dist/` into `@quartal/plugin/static/plugin-docs-web/` so the plugin ships the docs SPA
// without a runtime dependency on this plugin. Runs at the tail of `npm run build`. Node ESM — no
// Deno.
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const srcDir = fileURLToPath(new URL("../dist/", import.meta.url));
const destDir = fileURLToPath(new URL("../../plugin/static/plugin-docs-web/", import.meta.url));

try {
  await stat(srcDir);
} catch {
  console.error("dist/ not found. Run the SPA build (vite build) in @quartal/plugin-docs-web first.");
  process.exit(1);
}

await rm(destDir, { recursive: true, force: true });
await mkdir(destDir, { recursive: true });
await cp(srcDir, destDir, { recursive: true });

await writeFile(
  new URL("../../plugin/static/plugin-docs-web/BUILD_INFO.json", import.meta.url),
  JSON.stringify({ source: "@quartal/plugin-docs-web" }, null, 2) + "\n",
);

const files = await readdir(destDir);
console.log(`Vendored plugin-docs-web → @quartal/plugin/static/plugin-docs-web (${files.length} entries)`);
