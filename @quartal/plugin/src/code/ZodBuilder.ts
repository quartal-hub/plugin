import { z } from "@hono/zod-openapi";
import type { CodeArrayType, CodeFile, CodeFunction, CodeOrSystemType, CodePropOrParam, CodeType } from "../model/index.ts";
import { buildTypeIndex } from "./buildTypeIndex.ts";

/** Zod schema for a function: input (single object body) and output. */
export interface FunctionZodDefinition {
  /** Schema for the single object parameter (validates request body). */
  input: z.ZodType<Record<string, unknown>>;
  /** Schema for the return value. */
  returns: z.ZodType<unknown>;
  /** Function metadata. */
  fn: CodeFunction;
  /** File path (e.g. "tools/HelloWorld.ts"). */
  filePath: string;
  /** Class name if method, else undefined for standalone. */
  className?: string;
}

/** All type schemas keyed by type name. */
export type TypeZodMap = Map<string, z.ZodType<unknown>>;

/** All function definitions with their Zod schemas. */
export type FunctionZodList = FunctionZodDefinition[];

/**
 * Creates Zod schemas from CodeFile[] (from TsMorphAnalyzer).
 * Use for Open API, MCP, RPC: get param/return schemas per function and all types.
 */
export class ZodBuilder {
  private readonly files: CodeFile[];
  /** Type name -> CodeType (flattened from all files + anonymous). */
  private readonly typeMap = new Map<string, CodeType>();
  /** Type name -> Zod schema (built lazily to handle refs and extends). */
  private readonly schemaCache = new Map<string, z.ZodType<unknown>>();
  /** All types in order (for stable iteration). */
  private readonly typeNames: string[] = [];
  /** Types currently being built — used to break recursive type cycles. */
  private readonly buildingSet = new Set<string>();

  constructor(files: CodeFile[]) {
    this.files = files;
    this.buildTypeMap();
  }

  /**
   * Returns a Zod schema for the given type name or CodeType.
   * @param typeNameOrCodeType Type name string or inline {@link CodeType} definition.
   */
  getZodForType(typeNameOrCodeType: string | CodeType): z.ZodType<unknown> {
    const name = typeof typeNameOrCodeType === "string" ? typeNameOrCodeType : typeNameOrCodeType.name;
    let schema = this.schemaCache.get(name);
    if (schema) return schema;

    // Break recursive cycles (e.g. Tree.children: Tree[]) — return a plain object fallback.
    if (this.buildingSet.has(name)) return z.record(z.string(), z.unknown());

    const codeType = typeof typeNameOrCodeType === "string" ? this.typeMap.get(name) : typeNameOrCodeType;

    if (codeType) {
      this.buildingSet.add(name);
      schema = this.codeTypeToZod(codeType);
      this.buildingSet.delete(name);
      this.schemaCache.set(name, schema);
      return schema;
    }

    return z.unknown();
  }

  /**
   * Returns Zod for a function's single object parameter (for validation).
   * @param def Function Zod definition from {@link ZodBuilder.getZodForFunction}.
   */
  getZodForFunctionInput(def: FunctionZodDefinition): z.ZodType<Record<string, unknown>> {
    return def.input;
  }

  /**
   * Returns Zod for a function's return type.
   * @param def Function Zod definition from {@link ZodBuilder.getZodForFunction}.
   */
  getZodForFunctionReturns(def: FunctionZodDefinition): z.ZodType<unknown> {
    return def.returns;
  }

  /**
   * Returns the function definition (with params and returns Zod) for a file/class/method.
   * @param className - The class name.
   * @param methodName - The method name.
   * @returns The function definition or undefined if not found.
   */
  getZodForFunction(className: string, methodName: string): FunctionZodDefinition | undefined {
    const list = this.getZodsForAllFunctions();
    return list.find((f) => f.className === className && f.fn?.name === methodName);
  }

  /**
   * All type names -> Zod schemas.
   */
  getAllTypesZods(): TypeZodMap {
    for (const name of this.typeNames) {
      if (!this.schemaCache.has(name)) {
        const ct = this.typeMap.get(name);
        if (ct) this.schemaCache.set(name, this.codeTypeToZod(ct));
      }
    }
    return new Map(this.schemaCache);
  }

  /**
   * All functions with their param and return Zod schemas.
   * Request/response schema names are taken from codeFiles (same convention as TsMorphAnalyzer: [className]_[functionName]_Input/Output or user-named types).
   */
  getZodsForAllFunctions(): FunctionZodList {
    const result: FunctionZodDefinition[] = [];
    for (const file of this.files) {
      const filePath = file.path;
      for (const cls of file.classes) {
        for (const fn of cls.functions) {
          const requestName = fn.parameters.length === 1 && typeof fn.parameters[0].type === "string"
            ? fn.parameters[0].type.trim()
            : `${cls.name}_${fn.name}_Request`;
          const rawInput = this.paramsToZod(fn.parameters);
          const inputSchema = (rawInput as { openapi?: (name: string) => z.ZodType<unknown> }).openapi
            ? (rawInput as { openapi: (name: string) => z.ZodType<Record<string, unknown>> }).openapi(requestName)
            : rawInput;

          const responseName = typeof fn.returns.type === "string" ? fn.returns.type.trim() : `${cls.name}_${fn.name}_Response`;
          const rawReturns = this.getReturnsZod(fn.returns.type);
          const returnsSchema = (rawReturns as { openapi?: (name: string) => z.ZodType<unknown> }).openapi
            ? (rawReturns as { openapi: (name: string) => z.ZodType<unknown> }).openapi(responseName)
            : rawReturns;

          result.push({
            input: inputSchema as z.ZodType<Record<string, unknown>>,
            returns: returnsSchema,
            fn,
            filePath,
            className: cls.name,
          });
        }
      }
    }
    return result;
  }

  private buildTypeMap(): void {
    for (const [name, ct] of buildTypeIndex(this.files)) {
      if (!this.typeMap.has(name)) {
        this.typeMap.set(name, ct);
        this.typeNames.push(name);
      }
    }
    for (const file of this.files) {
      for (const cls of file.classes) {
        for (const fn of cls.functions) {
          for (const p of fn.parameters) {
            this.collectTypesFromCodeOrSystemType(p.type);
          }
          this.collectTypesFromCodeOrSystemType(fn.returns.type);
        }
      }
    }
  }

  private collectTypesFromCodeOrSystemType(t: CodeOrSystemType): void {
    if (typeof t === "string") return;
    if (typeof t === "object" && t !== null && "name" in t && "properties" in t) {
      const ct = t as CodeType;
      if (!this.typeMap.has(ct.name)) {
        this.typeMap.set(ct.name, ct);
        this.typeNames.push(ct.name);
      }
      for (const prop of ct.properties) {
        this.collectTypesFromCodeOrSystemType(prop.type);
      }
      return;
    }
    if (typeof t === "object" && t !== null && "items" in t) {
      this.collectTypesFromCodeOrSystemType((t as CodeArrayType).items);
    }
  }

  /**
   * Returns the Zod schema for a function's return type.
   * codeFiles already use Value type names (StringValue, NumberValue, etc.) for primitives; object types are by name.
   */
  private getReturnsZod(returnsType: CodeOrSystemType): z.ZodType<unknown> {
    if (typeof returnsType === "object" && returnsType !== null && "items" in returnsType) {
      return this.getZodForType("ArrayValue");
    }
    if (typeof returnsType === "string") {
      return this.getZodForType(returnsType.trim());
    }
    return this.getZodForType("UnknownValue");
  }

  private codeTypeToZod(ct: CodeType): z.ZodType<unknown> {
    if (ct.enum && ct.enum.length > 0) {
      return z.enum(ct.enum as [string, ...string[]]);
    }
    const shape: Record<string, z.ZodType<unknown>> = {};
    const collect = (c: CodeType): void => {
      for (const name of c.extends) {
        const base = this.typeMap.get(name);
        if (base) collect(base);
      }
      for (const prop of c.properties) {
        shape[prop.name] = this.propToZod(prop);
      }
    };
    collect(ct);
    return z.object(shape);
  }

  private paramsToZod(parameters: CodeFunction["parameters"]): z.ZodType<Record<string, unknown>> {
    // Convention in this repo: methods take a single object parameter (name doesn't matter: params/input/etc).
    // If there's exactly one parameter and it resolves to an object schema, validate the body directly (unwrapped).
    if (parameters.length === 1) {
      const only = parameters[0];
      const typeName = typeof only.type === "string" ? only.type.trim() : null;
      if (typeName && this.typeMap.has(typeName)) {
        const codeType = this.typeMap.get(typeName)!;
        if ("properties" in codeType && Array.isArray(codeType.properties)) {
          const schema = this.propToZod(only);
          return schema as unknown as z.ZodType<Record<string, unknown>>;
        }
      }
      const schema = this.propToZod({ ...only, name: "input" });
      if (schema instanceof z.ZodObject) {
        return schema as unknown as z.ZodType<Record<string, unknown>>;
      }
    }
    const shape: Record<string, z.ZodType<unknown>> = {};
    for (const p of parameters) {
      shape[p.name] = this.propToZod(p);
    }
    return z.object(shape);
  }

  private propToZod(p: CodePropOrParam): z.ZodType<unknown> {
    let schema = this.codeOrSystemTypeToZod(p.type);
    if (p.format) {
      schema = this.applyFormat(schema, p.format);
    }
    if (p.optional && p.nullable) {
      schema = schema.nullish();
    } else {
      if (p.nullable) {
        schema = schema.nullable();
      }
      if (p.optional) {
        schema = schema.optional();
      }
    }
    if (p.description) {
      schema = schema.describe(p.description);
    }
    if (p.summary) {
      schema = this.applyOpenApiMeta(schema, { title: p.summary });
    }
    if (p.example !== undefined) {
      schema = this.applyOpenApiMeta(schema, { example: p.example });
    }
    return schema;
  }

  private applyOpenApiMeta(schema: z.ZodType<unknown>, meta: { title?: string; example?: unknown }): z.ZodType<unknown> {
    const openApi = (schema as { openapi?: (meta: { title?: string; example?: unknown }) => z.ZodType<unknown> }).openapi;
    if (typeof openApi === "function") {
      return openApi.call(schema, meta);
    }
    return schema;
  }

  private applyFormat(schema: z.ZodType<unknown>, format: string): z.ZodType<unknown> {
    if (!(schema instanceof z.ZodString)) return schema;
    const f = format.trim().toLowerCase();
    // Use Zod 4 built-ins where available (https://zod.dev/api).
    if (f === "email") return z.email();
    if (f === "uuid") return z.uuid();
    if (f === "uri") return z.url();
    if (f === "date-time") return z.iso.datetime();
    if (f === "date") return z.iso.date();
    if (f === "time") return z.iso.time();
    if (f === "duration") return z.iso.duration();
    if (f === "uri-reference") {
      // Allow absolute URLs or relative refs like "/api/v1/users".
      return z.string().regex(/^(https?:\/\/|\/).+/);
    }
    return schema;
  }

  private codeOrSystemTypeToZod(t: CodeOrSystemType): z.ZodType<unknown> {
    if (typeof t === "string") {
      return this.stringTypeToZod(t);
    }
    if (typeof t === "object" && t !== null) {
      if ("name" in t && "properties" in t) {
        return this.codeTypeToZod(t as CodeType);
      }
      if ("items" in t) {
        const items = this.codeOrSystemTypeToZod((t as CodeArrayType).items);
        return z.array(items);
      }
    }
    return z.unknown();
  }

  private stringTypeToZod(s: string): z.ZodType<unknown> {
    const trimmed = s.trim();
    if (trimmed === "string") return z.string();
    if (trimmed === "number") return z.number();
    if (trimmed === "boolean") return z.boolean();
    if (trimmed === "null") return z.null();
    if (trimmed === "undefined") return z.undefined();
    if (trimmed === "void") return z.void();
    if (trimmed === "any" || trimmed === "unknown") return z.unknown();
    if (trimmed === "never") return z.never();
    if (trimmed === "object") return z.record(z.string(), z.unknown());
    if (trimmed === "symbol") return z.symbol();
    if (trimmed === "bigint") return z.bigint();

    if (trimmed.includes(" | ")) {
      const parts = trimmed.split("|").map((p) => p.trim());
      const stringEnum = this.parseStringLiteralUnionParts(parts);
      if (stringEnum) {
        return z.enum(stringEnum);
      }
      const literals = parts.every((p) => /^["'].*["']$/.test(p) || /^-?\d+$/.test(p) || /^(true|false)$/.test(p));
      if (literals) {
        const schemas = parts.map((p) => {
          if (p === "true") return z.literal(true);
          if (p === "false") return z.literal(false);
          if (p === "null") return z.null();
          if (/^-?\d+$/.test(p)) return z.literal(Number(p));
          return z.literal(p.replace(/^["']|["']$/g, ""));
        });
        return z.union(schemas as unknown as [z.ZodType<unknown>, z.ZodType<unknown>, ...z.ZodType<unknown>[]]);
      }
      const typeSchemas = parts.map((p) => this.getZodForType(p));
      return z.union(typeSchemas as unknown as [z.ZodType<unknown>, z.ZodType<unknown>, ...z.ZodType<unknown>[]]);
    }

    return this.getZodForType(trimmed);
  }

  private static readonly TYPE_KEYWORDS = new Set([
    "string",
    "number",
    "boolean",
    "null",
    "undefined",
    "void",
    "any",
    "unknown",
    "never",
    "object",
    "symbol",
    "bigint",
  ]);

  /** Unquoted/quoted string literal union parts → tuple for z.enum. */
  private parseStringLiteralUnionParts(parts: string[]): [string, ...string[]] | null {
    const values: string[] = [];
    for (const part of parts) {
      if (ZodBuilder.TYPE_KEYWORDS.has(part)) return null;
      if (/^["'].*["']$/.test(part)) {
        values.push(part.replace(/^["']|["']$/g, ""));
        continue;
      }
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(part)) {
        values.push(part);
        continue;
      }
      return null;
    }
    return values.length > 0 ? (values as [string, ...string[]]) : null;
  }
}
