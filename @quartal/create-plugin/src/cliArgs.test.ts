import { describe, expect, it } from "vitest";

import { parseCliArgs } from "./cliArgs.ts";

describe("parseCliArgs", () => {
  it("returns unanswered questions as undefined", () => {
    expect(parseCliArgs([])).toEqual({
      name: undefined,
      description: undefined,
      auth: undefined,
      sampleTool: undefined,
      widgets: undefined,
      yes: false,
      help: false,
    });
  });

  it("parses the positional name and every flag", () => {
    expect(
      parseCliArgs(["@org/my-plugin", "--description", "Does things.", "--auth", "--no-sample-tool", "--widgets", "react", "--yes"]),
    ).toEqual({
      name: "@org/my-plugin",
      description: "Does things.",
      auth: true,
      sampleTool: false,
      widgets: "react",
      yes: true,
      help: false,
    });
  });

  it("parses the negated and short forms", () => {
    const args = parseCliArgs(["my-plugin", "--no-auth", "--sample-tool", "-w", "none", "-y", "-d", "Hi."]);
    expect(args.auth).toBe(false);
    expect(args.sampleTool).toBe(true);
    expect(args.widgets).toBe("none");
    expect(args.yes).toBe(true);
    expect(args.description).toBe("Hi.");
  });

  it("parses --help", () => {
    expect(parseCliArgs(["-h"]).help).toBe(true);
  });

  it("rejects conflicting flags", () => {
    expect(() => parseCliArgs(["--auth", "--no-auth"])).toThrow(/mutually exclusive/);
    expect(() => parseCliArgs(["--sample-tool", "--no-sample-tool"])).toThrow(/mutually exclusive/);
  });

  it("rejects an unknown widget framework", () => {
    expect(() => parseCliArgs(["--widgets", "svelte"])).toThrow(/--widgets must be one of/);
  });

  it("rejects unknown flags and extra positionals", () => {
    expect(() => parseCliArgs(["--frobnicate"])).toThrow();
    expect(() => parseCliArgs(["one", "two"])).toThrow(/at most one positional/);
  });
});
