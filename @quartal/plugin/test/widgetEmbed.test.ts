import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import type { WidgetRoutes } from "@quartal/plugin-embed";
import { getAnonApp, type WidgetEntry } from "../src/index.ts";

const test1Dir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));
const ORIGIN = "https://hello.example";

const widget: WidgetEntry = { toolId: "sayHello", uri: "ui://widgets/sayHello.html", name: "Hello card", pagePath: "/widgets/sayHello" };

describe("widget embedding routes", () => {
  let app: Hono;

  beforeAll(async () => {
    app = await getAnonApp({ pluginRootFolder: test1Dir, widgetResources: [widget] });
  });

  const get = (path: string, headers: Record<string, string> = {}) => app.request(`${ORIGIN}${path}`, { headers });

  it("serves the route table: REST routes by MCP tool id and the widget pages", async () => {
    const res = await get("/widgets/routes.json", { origin: "https://page.example" });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const routes = (await res.json()) as WidgetRoutes;
    expect(routes.tools.sayHello).toEqual({ method: "POST", path: "/api/hello-world/say-hello", pathParams: [], inputIn: "body" });
    expect(routes.tools.multiply).toMatchObject({ method: "POST", path: "/api/calculator/multiply" });
    expect(routes.widgets).toEqual({ sayHello: { path: "/widgets/sayHello", title: "Hello card" } });
  });

  it("serves widgets.js with the route table baked in", async () => {
    const res = await get("/widgets.js", { origin: "https://page.example" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const script = await res.text();
    expect(script).not.toContain("__QRTL_WIDGETS_CONFIG__");
    expect(script).toContain("qrtl-widget");
    expect(script).toContain("/api/hello-world/say-hello");
  });

  it("serves an embedding guide per widget, with the widget-only tools as its events", async () => {
    const res = await get("/widgets/sayHello/embed.md");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    const md = await res.text();
    expect(md).toContain('# Embed the "Hello card" widget');
    expect(md).toContain(`<script type="module" src="${ORIGIN}/widgets.js"></script>`);
    expect(md).toContain('<qrtl-widget tool="sayHello"></qrtl-widget>');
    expect(md).toContain("type SayHelloInput = {");
    expect(md).toContain("- `multiply(");
    expect(md).toContain("The plugin's API is anonymous");
  });

  it("lists the widgets and 404s an unknown one", async () => {
    expect(await (await get("/widgets/embed.md")).text()).toContain(`[Hello card](${ORIGIN}/widgets/sayHello/embed.md)`);
    expect((await get("/widgets/nope/embed.md")).status).toBe(404);
  });
});
