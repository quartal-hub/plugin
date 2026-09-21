import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDocsShellFetcher,
  DEFAULT_DOCS_WEB_URL,
  resolveDocsWebUrl,
  rewriteDocsShellHtml,
} from "../src/index.ts";

// The docs shell: URL resolution precedence, asset-URL rewriting, and the TTL/fail-soft fetcher.

describe("resolveDocsWebUrl", () => {
  it("prefers env, then the configured value, then the default", () => {
    expect(resolveDocsWebUrl("https://cfg.example/x/")).toBe("https://cfg.example/x/");
    expect(resolveDocsWebUrl(undefined)).toBe(DEFAULT_DOCS_WEB_URL);
    process.env.QRTL_DOCS_WEB_URL = "https://env.example/shell/";
    try {
      expect(resolveDocsWebUrl("https://cfg.example/x/")).toBe("https://env.example/shell/");
    } finally {
      delete process.env.QRTL_DOCS_WEB_URL;
    }
  });
});

describe("rewriteDocsShellHtml", () => {
  const shellUrl = "https://plugin.quartal.com/plugin-index/";

  it("rewrites root-relative src/href to the shell origin", () => {
    const html = `<link rel="stylesheet" href="/_astro/a.css"><script type="module" src='/_astro/b.js'></script>`;
    const out = rewriteDocsShellHtml(html, shellUrl);
    expect(out).toContain(`href="https://plugin.quartal.com/_astro/a.css"`);
    expect(out).toContain(`src='https://plugin.quartal.com/_astro/b.js'`);
  });

  it("leaves absolute, protocol-relative and fragment references alone", () => {
    const html = [
      `<link href="https://cdn.quartal.com/skins/default.css">`,
      `<script src="//code.quartal.com/x.js"></script>`,
      `<a href="#/mcp">MCP</a>`,
      `<a href="docs/relative">rel</a>`,
    ].join("");
    expect(rewriteDocsShellHtml(html, shellUrl)).toBe(html);
  });
});

describe("createDocsShellFetcher", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  it("caches the fetched shell and survives the source disappearing (stale fallback)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qrtl-shell-"));
    dirs.push(dir);
    const file = join(dir, "shell.html");
    await writeFile(file, "<html>v1</html>");
    const getShell = createDocsShellFetcher(pathToFileURL(file).href);

    expect(await getShell()).toBe("<html>v1</html>");
    await rm(file);
    // Cached copy still served (fresh within the TTL, and stale fallback if it were not).
    expect(await getShell()).toBe("<html>v1</html>");
  });

  it("returns undefined when the shell was never reachable", async () => {
    const getShell = createDocsShellFetcher(pathToFileURL(join(tmpdir(), "qrtl-shell-missing.html")).href);
    expect(await getShell()).toBeUndefined();
  });
});
