import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeSource } from "./helpers/analyzeSource.ts";
import type { CodeFile, CodeType } from "../src/index.ts";

// --------------------------------------------------------------------------- committed golden content

const codeJson = JSON.parse(
  readFileSync(new URL("./fixtures/pkg/qrtl-plugin/tools.json", import.meta.url), "utf-8"),
) as { files: CodeFile[] };

const namedTypes = [
  "GreetingType", "MultiplyThese", "TypeTesterArraysInput", "TypeTesterArraysResult",
  "TypeTesterJsonSchemaFormats", "TypeTesterMixed", "TypeTesterNestedObjectInput",
  "TypeTesterNestedObjectResult", "TypeTesterOptionalAndNull", "TypeTesterPrimitives",
  "TypeTesterTree", "TypeTesterUnionParam",
];
const anonymousTypes = [
  "Calculator_add_Input", "HelloWorld_sayHello_Input", "TypesTester_unionParam_Output",
  "HelloWorld_sayHelloWithThis_Input",
];

describe("golden tools.json content (produced by TsMorphAnalyzer)", () => {
  const pluginTypes = () =>
    codeJson.files.filter((f) => f.path !== "__system__.ts").flatMap((f) => f.types);

  it("contains all named and anonymous types, and only those", () => {
    const names = codeJson.files.flatMap((f) => f.types).map((t) => t.name);
    for (const t of [...namedTypes, ...anonymousTypes]) expect(names).toContain(t);
    const unknown = pluginTypes().map((t) => t.name).filter((n) => !namedTypes.includes(n) && !anonymousTypes.includes(n));
    expect(unknown, `Unknown types: ${unknown.join(", ")}`).toHaveLength(0);
  });

  it("inlines nested object types", () => {
    const target = codeJson.files.flatMap((f) => f.types).find((t) => t.name === "TypeTesterNestedObjectInput");
    const payload = target?.properties.find((p) => p.name === "payload");
    const payloadType = payload?.type as CodeType;
    expect(payloadType.properties.map((p) => p.name).sort()).toEqual(["name", "score"]);
  });

  it("captures optional / nullable flags", () => {
    const target = codeJson.files.flatMap((f) => f.types).find((t) => t.name === "TypeTesterOptionalAndNull");
    expect(target?.properties).toContainEqual({ name: "optional", type: "string", description: "Optional string.", optional: true, nullable: false });
    expect(target?.properties).toContainEqual({ name: "nullable", type: "number", description: "Explicitly nullable number.", optional: false, nullable: true });
    expect(target?.properties).toContainEqual({ name: "nullish", type: "boolean", description: "May be optional or null.", optional: true, nullable: true });
  });
});

// --------------------------------------------------------------------------- analyzer behaviour (in-memory)

describe("TsMorphAnalyzer private members", () => {
  const SOURCE = `
    /** Method visibility. */
    export class MethodVisibility {
      publicInstance(): void {}
      private privateInstance(): void {}
      static publicStatic(): void {}
      private static privateStatic(): void {}
    }
    /** Property visibility. */
    export class PropertyVisibility {
      publicProp: string = "";
      private privateProp: string = "";
      publicMethod(): void {}
    }
    /** Only private methods. */
    export class OnlyPrivateMethods {
      visible: string = "";
      private privateInstance(): void {}
      private static privateStatic(): void {}
    }
  `;
  const file = () => analyzeSource({ "/tools/Visibility.ts": SOURCE }).find((f) => f.path === "tools/Visibility.ts")!;

  it("omits private methods, keeps public instance + static", () => {
    const cls = file().classes.find((c) => c.name === "MethodVisibility")!;
    expect(cls.functions.map((fn) => fn.name).sort()).toEqual(["publicInstance", "publicStatic"]);
    expect(cls.functions.find((fn) => fn.name === "publicInstance")?.isStatic).toBe(false);
    expect(cls.functions.find((fn) => fn.name === "publicStatic")?.isStatic).toBe(true);
  });

  it("omits private class properties", () => {
    const cls = file().classes.find((c) => c.name === "PropertyVisibility")!;
    expect(cls.properties.map((p) => p.name)).toEqual(["publicProp"]);
  });

  it("emits an all-private-method class as a CodeType (fields only)", () => {
    const f = file();
    expect(f.classes.some((c) => c.name === "OnlyPrivateMethods")).toBe(false);
    const asType = f.types.find((t) => t.name === "OnlyPrivateMethods")!;
    expect(asType.properties.map((p) => p.name)).toEqual(["visible"]);
  });
});

describe("TsMorphAnalyzer type mapping", () => {
  it("maps keywords, arrays, refs, unions, inline objects, and nullability", () => {
    const files = analyzeSource({
      "/tools/Types.ts": `
        export interface RefTarget { id: string; }
        /** Shapes. */
        export interface Shapes {
          /** label */ label: string;
          /** count */ count: number;
          /** items */ items: string[];
          /** ref */ ref: RefTarget;
          /** mixed */ mixed: string | number;
          /** nested */ nested: { inner: string };
          /** nullableStr */ nullableStr: string | null;
          /** optionalNum */ optionalNum?: number;
          /** both */ both?: boolean | null;
        }
      `,
    });
    const t = files.flatMap((f) => f.types).find((t) => t.name === "Shapes")!;
    const byName = Object.fromEntries(t.properties.map((p) => [p.name, p]));
    expect(byName.label.type).toBe("string");
    expect(byName.count.type).toBe("number");
    expect(byName.items.type).toEqual({ items: "string" });
    expect(byName.ref.type).toBe("RefTarget");
    expect(byName.mixed.type).toBe("string | number");
    expect((byName.nested.type as CodeType).properties[0].name).toBe("inner");
    expect(byName.nullableStr).toMatchObject({ type: "string", nullable: true, optional: false });
    expect(byName.optionalNum).toMatchObject({ type: "number", optional: true, nullable: false });
    expect(byName.both).toMatchObject({ type: "boolean", optional: true, nullable: true });
  });

  it("keeps only the first method parameter and value-wraps primitive returns; unwraps Promise", () => {
    const files = analyzeSource({
      "/tools/Svc.ts": `
        /** Service. */
        export class Svc {
          /**
           * Do something.
           * @param input The input.
           * @returns A string.
           */
          static async doSomething(input: string, ctx: { userId: string }): Promise<string> { return input; }
        }
      `,
    });
    const fn = files.flatMap((f) => f.classes).find((c) => c.name === "Svc")!.functions.find((f) => f.name === "doSomething")!;
    expect(fn.isAsync).toBe(true);
    expect(fn.isStatic).toBe(true);
    expect(fn.parameters).toHaveLength(1);
    expect(fn.parameters[0].name).toBe("input");
    expect(fn.parameters[0].description).toBe("The input.");
    expect(fn.returns.type).toBe("StringValue");
    expect(fn.returns.description).toBe("A string.");
  });

  it("treats a string-literal type alias as an enum", () => {
    const files = analyzeSource({
      "/tools/Lang.ts": `
        /** Language. */
        export type Language = "fi" | "sv" | "en";
        /** Uses it. */
        export interface Report { /** lang */ lang?: Language; }
      `,
    });
    const lang = files.flatMap((f) => f.types).find((t) => t.name === "Language")!;
    expect(lang.enum).toEqual(["fi", "sv", "en"]);
  });
});

describe("TsMorphAnalyzer imported-types closure", () => {
  it("emits transitively-referenced types declared outside tools/ into imported-types.ts", () => {
    const files = analyzeSource({
      "/vendor/salaxy.ts": `
        /** A row. */
        export interface UserDefinedRow { /** price */ price: number; }
        /** A calculation. */
        export interface Calculation { /** id */ id: string; /** rows */ rows: UserDefinedRow[]; }
      `,
      "/tools/Calculator.ts": `
        import type { Calculation } from "../vendor/salaxy.ts";
        /** Calculator. */
        export class Calculator {
          /**
           * Compute.
           * @param input the id
           * @returns the calculation
           */
          static async compute(input: string): Promise<Calculation> { return { id: input, rows: [] }; }
        }
      `,
    });
    const imported = files.find((f) => f.path === "types/imported-types.ts");
    expect(imported).toBeDefined();
    const names = imported!.types.map((t) => t.name).sort();
    expect(names).toEqual(["Calculation", "UserDefinedRow"]);
    const calc = imported!.types.find((t) => t.name === "Calculation")!;
    expect(calc.properties.map((p) => p.name)).toEqual(["id", "rows"]);
    const row = imported!.types.find((t) => t.name === "UserDefinedRow")!;
    expect(row.properties.map((p) => p.name)).toEqual(["price"]);
  });
});
