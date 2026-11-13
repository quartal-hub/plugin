import { describe, expect, it } from "vitest";
import { injectDocsSpaTitle } from "../src/hono-app/docsSpaHtml.ts";

// The docs page title names the plugin: `<plugin title> - Quartal Plugin`.

describe("injectDocsSpaTitle", () => {
  const shell = "<html><head>\n    <title>Quartal Plugin</title>\n  </head><body></body></html>";

  it("replaces the shell's title with the plugin's", () => {
    expect(injectDocsSpaTitle(shell, "Auth Agent")).toContain("<title>Auth Agent - Quartal Plugin</title>");
    expect(injectDocsSpaTitle(shell, "Auth Agent")).not.toContain("<title>Quartal Plugin</title>");
  });

  it("escapes the title and keeps `$` patterns literal", () => {
    expect(injectDocsSpaTitle(shell, "R&D <Tools> $& co")).toContain(
      "<title>R&amp;D &lt;Tools&gt; $&amp; co - Quartal Plugin</title>",
    );
  });

  it("adds a title to a shell without one, and falls back to the suffix alone", () => {
    expect(injectDocsSpaTitle("<html><head></head></html>", "X")).toContain("<title>X - Quartal Plugin</title>");
    expect(injectDocsSpaTitle(shell, "  ")).toContain("<title>Quartal Plugin</title>");
  });
});
