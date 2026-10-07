import { describe, expect, it } from "vitest";

import { buildMcpTools, loadCodeFiles } from "../src/index.ts";
import { analyzeSource } from "./helpers/analyzeSource.ts";

const SOURCE = `
  /** Annotation tags. */
  export class Notes {
    /** Reads a note.
     * @readOnly
     */
    read(): string { return ""; }
    /** Writes a note, replacing an older one with the same name.
     * @idempotent
     * @destructive
     */
    write(): void {}
    /** Appends to a note, which never removes anything.
     * @destructive false
     * @openWorld false
     */
    append(): void {}
    /** An explicit false, and a value that is not understood.
     * @readOnly false
     * @idempotent maybe
     */
    odd(): void {}
    /** No tags at all. */
    plain(): void {}
  }
`;

const files = () => analyzeSource({ "/tools/Notes.ts": SOURCE });
const functions = () => files().find((f) => f.path === "tools/Notes.ts")!.classes[0].functions;

describe("tool annotation tags", () => {
  it("parses @readOnly, @destructive, @idempotent and @openWorld", () => {
    const byName = Object.fromEntries(functions().map((fn) => [fn.name, fn.annotations]));
    expect(byName.read).toEqual({ readOnlyHint: true });
    expect(byName.write).toEqual({ idempotentHint: true, destructiveHint: true });
    expect(byName.append).toEqual({ destructiveHint: false, openWorldHint: false });
    expect(byName.odd).toEqual({ readOnlyHint: false });
    expect(byName.plain).toBeUndefined();
  });

  it("reach the MCP tool descriptors", () => {
    const tools = buildMcpTools(loadCodeFiles({ files: files() }));
    expect(tools.find((t) => t.methodName === "read")?.annotations).toEqual({ readOnlyHint: true });
    expect(tools.find((t) => t.methodName === "plain")?.annotations).toBeUndefined();
  });
});
