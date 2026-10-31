import { gzipSync } from "node:zlib";
import { transform } from "esbuild";
import { describe, expect, it } from "vitest";
import { renderWidgetsScript, WIDGETS_SCRIPT_CONFIG_PLACEHOLDER, WIDGETS_SCRIPT_SOURCE } from "../src/script/index.ts";
import type { WidgetRoutes } from "../src/model/index.ts";

const routes: WidgetRoutes = {
  name: "hello",
  title: "Hello \"world\" </script> ",
  tools: { sayHello: { method: "POST", path: "/api/hello/say-hello", pathParams: [], inputIn: "body" } },
  widgets: { sayHello: { path: "/widgets/sayHello" } },
};

describe("widgets.js", () => {
  it("stays within the 10 KB gzip budget", () => {
    const gzipped = gzipSync(renderWidgetsScript(routes)).length;
    expect(gzipped).toBeLessThanOrEqual(10 * 1024);
  });

  it("bakes the route table into a valid module", async () => {
    expect(WIDGETS_SCRIPT_SOURCE).toContain(WIDGETS_SCRIPT_CONFIG_PLACEHOLDER);
    const script = renderWidgetsScript(routes);
    expect(script).not.toContain(WIDGETS_SCRIPT_CONFIG_PLACEHOLDER);
    await expect(transform(script, { format: "esm", loader: "js" })).resolves.toBeDefined();
    const literal = /JSON\.parse\(("(?:[^"\\]|\\.)*")\)/.exec(script)?.[1];
    expect(JSON.parse(JSON.parse(literal!))).toEqual(routes);
  });
});
