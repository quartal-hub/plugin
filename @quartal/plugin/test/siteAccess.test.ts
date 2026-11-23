import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { getAnonApp } from "../src/index.ts";
import { createPluginMiddleware, pathGlobMatcher } from "../src/astro/pluginMiddleware.ts";
import { safeReturnPath } from "../src/hono-app/oauthLoginRoutes.ts";
import { resolveSiteRedirect } from "../src/hono-app/docsSpaRoutes.ts";

// The `site` options: a redirected start page, page sign-in with public globs, and the guards on
// the login's return path.

const pkgDir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

describe("site.root redirect", () => {
  it("redirects / and the docs paths, with the placeholders filled", async () => {
    const app = await getAnonApp({
      pluginRootFolder: pkgDir,
      toolModules: {},
      site: { root: { redirect: "https://hub.example/plugins/{name}?from={origin}" } },
    });
    for (const path of ["/", "/skills.html"]) {
      const res = await app.fetch(new Request(`http://plugin.localhost${path}`));
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("https://hub.example/plugins/%40samples%2Ftest1?from=http%3A%2F%2Fplugin.localhost");
    }
    // The machine routes are not affected.
    expect((await app.fetch(new Request("http://plugin.localhost/plugin.json"))).status).toBe(200);
  });

  it("fills placeholders URL-encoded", () => {
    expect(resolveSiteRedirect("https://x/{name}", "a b", "http://o")).toBe("https://x/a%20b");
  });
});

describe("pathGlobMatcher", () => {
  it("matches * within a segment and ** across segments", () => {
    expect(pathGlobMatcher("/register/**")("/register/step/2")).toBe(true);
    expect(pathGlobMatcher("/register/**")("/register/")).toBe(true);
    expect(pathGlobMatcher("/register/**")("/registered")).toBe(false);
    expect(pathGlobMatcher("/forms/*")("/forms/a")).toBe(true);
    expect(pathGlobMatcher("/forms/*")("/forms/a/b")).toBe(false);
    expect(pathGlobMatcher("/a.b")("/aXb")).toBe(false);
  });
});

describe("safeReturnPath", () => {
  it("accepts same-origin paths only", () => {
    expect(safeReturnPath("/page?x=1")).toBe("/page?x=1");
    expect(safeReturnPath("//evil.example")).toBeUndefined();
    expect(safeReturnPath("https://evil.example")).toBeUndefined();
    expect(safeReturnPath("/\\evil.example")).toBeUndefined();
    expect(safeReturnPath(undefined)).toBeUndefined();
  });
});

describe("page sign-in in the middleware", () => {
  const fakeApp = () => {
    const app = new Hono();
    app.get("/oauth/session", (c) =>
      c.req.header("cookie")?.includes("qrtl_session=good")
        ? c.json({ authenticated: true, uid: "u1" })
        : c.json({ error: "no session" }, 401));
    return app;
  };
  const page = new Response("page");
  const run = async (path: string, cookie?: string) => {
    const mw = createPluginMiddleware(fakeApp(), { pageAccess: { public: ["/register/**"] } });
    const locals: Record<string, unknown> = {};
    const request = new Request(`http://p.localhost${path}`, { headers: cookie ? { cookie } : {} });
    const res = await mw({ request, locals }, async () => page);
    return { res, locals };
  };

  it("redirects a page without a session to the login, keeping the page", async () => {
    const { res } = await run("/app/home?tab=2");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://p.localhost/oauth/login?return_to=%2Fapp%2Fhome%3Ftab%3D2");
  });

  it("renders the page with the session in locals", async () => {
    const { res, locals } = await run("/app/home", "qrtl_session=good");
    expect(res).toBe(page);
    expect(locals.qrtlSession).toEqual({ authenticated: true, uid: "u1" });
  });

  it("leaves public pages, widget pages and assets open", async () => {
    for (const path of ["/register/form", "/widgets/calc", "/_astro/x.js"]) {
      expect((await run(path)).res).toBe(page);
    }
  });
});
