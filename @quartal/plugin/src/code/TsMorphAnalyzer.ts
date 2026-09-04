import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  type ClassDeclaration,
  type InterfaceDeclaration,
  type JSDocableNode,
  type MethodDeclaration,
  Node,
  type ParameterDeclaration,
  Project,
  type PropertyDeclaration,
  type PropertySignature,
  type SourceFile,
  ts,
  type TypeAliasDeclaration,
  type TypeNode,
} from "ts-morph";

import type { CodeClass, CodeFile, CodeFunction, CodeOrSystemType, CodePropOrParam, CodeType, McpToolVisibility } from "../model/index.ts";

type ShapeMember = PropertySignature | PropertyDeclaration;
type TypeDecl = InterfaceDeclaration | TypeAliasDeclaration | ClassDeclaration;

/**
 * Analyzes a plugin's `tools/` TypeScript with the TypeScript compiler (via ts-morph) and produces a
 * logical tree of {@link CodeFile}, {@link CodeClass}, and {@link CodeType} with all the information
 * needed to build Zod schemas, OpenAPI, MCP, RPC, and HTML documentation.
 *
 * The TypeScript type checker resolves the import graph natively, so no custom module registry is
 * needed.
 */
export class TsMorphAnalyzer {
  /** Types collected from the transitive closure of imported (non-`tools/`) modules, keyed by name. */
  private importedTypes = new Map<string, CodeType>();

  /**
   * Analyze a plugin by entry module and return one {@link CodeFile} per `tools/` source file (plus a
   * synthetic `imported-types.ts` for transitively-referenced external types).
   * @param entryPath Absolute path to the entry module (e.g. `<pkg>/tools/mod.ts`).
   * @param options Optional plugin root used to locate `tsconfig.json` for module resolution.
   */
  analyzeEntry(entryPath: string, options?: { cwd?: string }): CodeFile[] {
    const cwd = options?.cwd;
    const tsConfigFilePath = cwd && existsSync(join(cwd, "tsconfig.json")) ? join(cwd, "tsconfig.json") : undefined;

    const project = new Project({
      ...(tsConfigFilePath ? { tsConfigFilePath } : {}),
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        // Forced regardless of the project's tsconfig so analysis is consistent and explicit `.ts`
        // import specifiers resolve. `allowJs` keeps the door open for future JS ("formula") analysis.
        allowImportingTsExtensions: true,
        allowJs: true,
        skipLibCheck: true,
        noEmit: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        strict: true,
      },
    });
    const entry = project.addSourceFileAtPath(entryPath);
    project.resolveSourceFileDependencies();
    return this.analyzeProject(project, { entry });
  }

  /**
   * Analyze an already-constructed ts-morph {@link Project}. Tool files are the `/tools/` source files
   * reachable from the entry's export graph (`export *` chains); every other referenced type is
   * gathered into `imported-types.ts`. Utilities imported only for implementation (not re-exported
   * from the entry) are excluded.
   * @param project A ts-morph project with the tool sources (and their dependencies) added.
   * @param options `entry` is the tool barrel (`tools/mod.ts`); its exports define the tool surface.
   *   When omitted, every `/tools/` source file is treated as a tool file (legacy fallback).
   */
  analyzeProject(project: Project, options?: { entry?: SourceFile }): CodeFile[] {
    this.importedTypes = new Map();

    // When an entry is given, restrict tool files to those declaring a symbol exported from it, so
    // implementation-only utilities under `tools/` (e.g. `tools/utils/*`) are not exposed as tools.
    let exportedFiles: Set<string> | undefined;
    if (options?.entry) {
      exportedFiles = new Set<string>();
      for (const decls of options.entry.getExportedDeclarations().values()) {
        for (const d of decls) {
          const p = d.getSourceFile().getFilePath();
          if (toolsPath(p)) exportedFiles.add(p);
        }
      }
    }

    const files: CodeFile[] = [];
    const toolDecls: TypeDecl[] = [];
    for (const sf of project.getSourceFiles()) {
      const path = toolsPath(sf.getFilePath());
      if (!path) continue;
      if (exportedFiles && !exportedFiles.has(sf.getFilePath())) continue;

      const classes: CodeClass[] = [];
      const types: CodeType[] = [];

      for (const cls of sf.getClasses()) {
        if (!cls.isExported()) continue;
        toolDecls.push(cls);
        const hasPublicMethod = cls.getMethods().some((m) => !isPrivateMember(m));
        if (hasPublicMethod) classes.push(this.parseClass(cls, types));
        else types.push(this.parseClassAsType(cls, types));
      }
      for (const iface of sf.getInterfaces()) {
        if (!iface.isExported()) continue;
        toolDecls.push(iface);
        types.push(this.parseInterface(iface, types));
      }
      for (const alias of sf.getTypeAliases()) {
        if (!alias.isExported()) continue;
        toolDecls.push(alias);
        types.push(this.parseTypeAlias(alias, types));
      }

      if (!classes.length && !types.length) continue;
      files.push({ name: path.replace(/^.*\//, ""), lang: "ts", path, content: "", classes, types });
    }

    const definedInTools = new Set(files.flatMap((f) => f.types.map((t) => t.name)));
    const importedTypes = this.buildImportedTypes(toolDecls, definedInTools);
    if (importedTypes.length > 0) {
      files.push({
        name: "imported-types.ts",
        lang: "ts",
        path: "types/imported-types.ts",
        content: "",
        classes: [],
        types: importedTypes,
      });
    }

    return files.sort((a, b) => a.path.localeCompare(b.path));
  }

  // ------------------------------------------------------------------ declaration parsers

  private parseClass(cls: ClassDeclaration, fileTypes: CodeType[]): CodeClass {
    const methods = cls.getMethods().filter((m) => !isPrivateMember(m));
    const props = cls.getProperties().filter((p) => !isPrivateMember(p));
    return {
      name: cls.getName() ?? "?",
      description: description(cls),
      functions: methods.map((m) => this.parseMethod(m, fileTypes, cls.getName() ?? "?")),
      properties: props.map((p) => this.parseProperty(p, fileTypes)),
      implements: cls.getImplements().map((i) => i.getExpression().getText()),
    };
  }

  private parseClassAsType(cls: ClassDeclaration, fileTypes: CodeType[]): CodeType {
    const props = cls.getProperties().filter((p) => !isPrivateMember(p));
    return {
      name: cls.getName() ?? "?",
      description: description(cls),
      properties: props.map((p) => this.parseProperty(p, fileTypes)),
      extends: cls.getImplements().map((i) => i.getExpression().getText()),
    };
  }

  private parseInterface(iface: InterfaceDeclaration, fileTypes: CodeType[]): CodeType {
    return {
      name: iface.getName(),
      description: description(iface),
      properties: iface.getProperties().map((p) => this.parseProperty(p, fileTypes)),
      extends: iface.getExtends().map((e) => e.getExpression().getText()),
    };
  }

  private parseTypeAlias(alias: TypeAliasDeclaration, fileTypes: CodeType[]): CodeType {
    const node = alias.getTypeNode();
    const base = { name: alias.getName(), description: description(alias), properties: [], extends: [] } as CodeType;

    if (node && Node.isUnionTypeNode(node)) {
      const enumValues = stringLiteralUnionValues(unionNonNullMembers(node.getTypeNodes()));
      if (enumValues) return { ...base, enum: enumValues };
    }
    if (node && Node.isTypeLiteral(node)) {
      return { ...base, properties: node.getProperties().map((p) => this.parseProperty(p, fileTypes)) };
    }
    // `type X = SomeImported` — copy the resolved shape under the alias name.
    if (node && Node.isTypeReference(node)) {
      const target = resolveTypeDecl(node);
      if (target && Node.isInterfaceDeclaration(target)) {
        return { ...this.parseInterface(target, fileTypes), name: alias.getName(), description: base.description || description(target) };
      }
      if (target && Node.isTypeAliasDeclaration(target)) {
        return { ...this.parseTypeAlias(target, fileTypes), name: alias.getName(), description: base.description || description(target) };
      }
    }
    return base;
  }

  private parseMethod(method: MethodDeclaration, fileTypes: CodeType[], className: string): CodeFunction {
    const name = method.getName();
    const returnNode = unwrapPromise(method.getReturnTypeNode());
    const rawReturn = this.typeNodeToCode(returnNode, fileTypes, { preferredName: `${className}_${name}_Output` });
    const returnRef = primitiveToValueRef(rawReturn, { unwrapInlineArray: true });

    const fn: CodeFunction = {
      name,
      description: description(method),
      // Only the first parameter is public input; later parameters carry injected context (auth,
      // request, …) supplied by middleware and must not appear in OpenAPI / MCP / Zod schemas.
      parameters: method.getParameters().slice(0, 1).map((p) => this.parseParam(p, method, fileTypes, className, name)),
      returns: { name: "", type: returnRef, description: returnDoc(method) },
      isAsync: method.isAsync(),
      isStatic: method.isStatic(),
    };
    const summary = summaryTag(method);
    if (summary) fn.summary = summary;
    const visibility = visibilityTag(method);
    if (visibility) fn.visibility = visibility;
    return fn;
  }

  private parseProperty(prop: ShapeMember, fileTypes: CodeType[]): CodePropOrParam {
    const typeNode = prop.getTypeNode();
    const { nullable, optional } = nullability(typeNode);
    const out: CodePropOrParam = {
      name: prop.getName(),
      type: this.typeNodeToCode(typeNode, fileTypes),
      description: description(prop),
      optional: prop.hasQuestionToken() || optional,
      nullable,
    };
    const sum = summaryTag(prop);
    if (sum !== undefined) out.summary = sum;
    const fmt = formatTag(prop);
    if (fmt !== undefined) out.format = fmt;
    const ex = exampleTag(prop);
    if (ex !== undefined) out.example = ex;
    return out;
  }

  private parseParam(
    param: ParameterDeclaration,
    method: MethodDeclaration,
    fileTypes: CodeType[],
    className: string,
    methodName: string,
  ): CodePropOrParam {
    const typeNode = param.getTypeNode();
    const { nullable, optional } = nullability(typeNode);
    const raw = this.typeNodeToCode(typeNode, fileTypes, { preferredName: `${className}_${methodName}_Input` });
    // Parameters carry no JSDoc of their own (description comes from the method's `@param` tag); `@format`
    // / `@example` only appear on object properties, so they are not read here.
    return {
      name: param.getName(),
      type: primitiveToValueRef(raw),
      description: paramDoc(method, param.getName()),
      optional: param.hasQuestionToken() || optional,
      nullable,
    };
  }

  // ------------------------------------------------------------------ type-node → CodeOrSystemType

  private typeNodeToCode(typeNode: TypeNode | undefined, fileTypes: CodeType[], opts?: { preferredName?: string }): CodeOrSystemType {
    if (!typeNode) return "any";

    const kw = KEYWORD_BY_KIND[typeNode.getKind()];
    if (kw) return kw;

    if (Node.isTypeReference(typeNode)) {
      return typeNode.getTypeName().getText();
    }
    if (Node.isArrayTypeNode(typeNode)) {
      return { items: this.typeNodeToCode(typeNode.getElementTypeNode(), fileTypes) };
    }
    if (Node.isUnionTypeNode(typeNode)) {
      const members = unionNonNullMembers(typeNode.getTypeNodes());
      if (members.length === 1) return this.typeNodeToCode(members[0], fileTypes, opts);
      const enumValues = stringLiteralUnionValues(members);
      if (enumValues) return enumValues.join(" | ");
      const parts = members.map((m) => this.typeNodeToCode(m, fileTypes));
      return parts.every((p) => typeof p === "string") ? parts.join(" | ") : "any";
    }
    if (Node.isLiteralTypeNode(typeNode)) {
      const lit = typeNode.getLiteral();
      if (Node.isStringLiteral(lit)) return lit.getLiteralValue();
    }
    if (Node.isTypeLiteral(typeNode)) {
      const props = typeNode.getProperties().map((p) => this.parseProperty(p, fileTypes));
      const inline: CodeType = { name: "", description: "", properties: props, extends: [] };
      const desired = opts?.preferredName?.trim();
      const taken = (n: string) => fileTypes.some((ft) => ft.name === n);
      if (desired && !taken(desired)) {
        fileTypes.push({ ...inline, name: desired });
        return desired;
      }
      return inline;
    }
    return "any";
  }

  // ------------------------------------------------------------------ imported-types transitive closure

  /**
   * Emits types reachable from `tools/` API surfaces that are declared outside `tools/` — the
   * transitive closure over imported (e.g. `@salaxy/core`) types. BFS from the tool declarations'
   * API-surface type nodes (signatures + type defs, never method bodies), resolving each reference
   * to its declaration via the type checker.
   * @param toolDecls Exported class/interface/type-alias declarations found in `tools/`.
   * @param definedInTools Names already emitted as tool-file types (never duplicated into imports).
   */
  private buildImportedTypes(toolDecls: TypeDecl[], definedInTools: Set<string>): CodeType[] {
    const seen = new Set<string>();
    const queue: TypeDecl[] = [];
    for (const decl of toolDecls) for (const ref of collectExternalRefs(decl)) queue.push(ref);

    while (queue.length) {
      const decl = queue.pop()!;
      const name = getDeclName(decl);
      if (!name || definedInTools.has(name) || seen.has(name)) continue;
      seen.add(name);

      const scratch: CodeType[] = [];
      const codeType = Node.isInterfaceDeclaration(decl)
        ? this.parseInterface(decl, scratch)
        : Node.isTypeAliasDeclaration(decl)
        ? this.parseTypeAlias(decl, scratch)
        : this.parseClassAsType(decl, scratch);
      registerBestInfo(this.importedTypes, codeType);
      for (const t of scratch) if (t.name && !definedInTools.has(t.name)) registerBestInfo(this.importedTypes, t);

      for (const ref of collectExternalRefs(decl)) queue.push(ref);
    }

    return [...this.importedTypes.values()]
      .filter((t) => !definedInTools.has(t.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

// ==================================================================== module-level helpers

const KEYWORD_BY_KIND: Record<number, CodeOrSystemType> = {
  [ts.SyntaxKind.StringKeyword]: "string",
  [ts.SyntaxKind.NumberKeyword]: "number",
  [ts.SyntaxKind.BooleanKeyword]: "boolean",
  [ts.SyntaxKind.NullKeyword]: "null",
  [ts.SyntaxKind.UndefinedKeyword]: "undefined",
  [ts.SyntaxKind.VoidKeyword]: "void",
  [ts.SyntaxKind.AnyKeyword]: "any",
  [ts.SyntaxKind.UnknownKeyword]: "unknown",
  [ts.SyntaxKind.NeverKeyword]: "never",
  [ts.SyntaxKind.ObjectKeyword]: "object",
  [ts.SyntaxKind.SymbolKeyword]: "symbol",
  [ts.SyntaxKind.BigIntKeyword]: "bigint",
};

function toolsPath(absFile: string): string | null {
  const norm = absFile.replace(/\\/g, "/");
  // Both plugin source folders share the analysis pipeline: `tools/` (MCP tools + REST) and
  // `prompts/` (MCP prompts). Files under either are analyzed; everything else becomes imported types.
  const m = norm.match(/\/(tools|prompts)\/(.+)$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

function isPrivateMember(member: MethodDeclaration | PropertyDeclaration): boolean {
  return member.getScope() === "private" || member.hasModifier(ts.SyntaxKind.PrivateKeyword);
}

function isNullNode(m: TypeNode): boolean {
  return m.getKind() === ts.SyntaxKind.NullKeyword || m.getText() === "null" ||
    (Node.isLiteralTypeNode(m) && m.getLiteral().getKind() === ts.SyntaxKind.NullKeyword);
}
function isUndefinedNode(m: TypeNode): boolean {
  return m.getKind() === ts.SyntaxKind.UndefinedKeyword || m.getText() === "undefined";
}
function unionNonNullMembers(members: TypeNode[]): TypeNode[] {
  return members.filter((m) => !isNullNode(m) && !isUndefinedNode(m));
}
/** Detection only (no rewrite): does this (possibly union) type node include null / undefined? */
function nullability(typeNode: TypeNode | undefined): { nullable: boolean; optional: boolean } {
  if (!typeNode || !Node.isUnionTypeNode(typeNode)) return { nullable: false, optional: false };
  let nullable = false, optional = false;
  for (const m of typeNode.getTypeNodes()) {
    if (isNullNode(m)) nullable = true;
    if (isUndefinedNode(m)) optional = true;
  }
  return { nullable, optional };
}

function stringLiteralUnionValues(members: TypeNode[]): string[] | null {
  const values: string[] = [];
  for (const m of members) {
    if (Node.isLiteralTypeNode(m)) {
      const lit = m.getLiteral();
      if (Node.isStringLiteral(lit)) {
        values.push(lit.getLiteralValue());
        continue;
      }
    }
    return null;
  }
  return values.length ? values : null;
}

function unwrapPromise(typeNode: TypeNode | undefined): TypeNode | undefined {
  if (typeNode && Node.isTypeReference(typeNode) && typeNode.getTypeName().getText() === "Promise") {
    return typeNode.getTypeArguments()[0];
  }
  return typeNode;
}

/** Maps primitive types to the system `Value` wrappers used in the API surface. */
function primitiveToValueRef(type: CodeOrSystemType, options?: { unwrapInlineArray?: boolean }): CodeOrSystemType {
  if (typeof type === "string") {
    const s = type.trim();
    const map: Record<string, CodeOrSystemType> = {
      string: "StringValue",
      number: "NumberValue",
      boolean: "BooleanValue",
      null: "NullValue",
      undefined: "UndefinedValue",
      void: "VoidValue",
      array: "ArrayValue",
    };
    if (map[s]) return map[s];
    if (["any", "unknown", "never"].includes(s)) return "UnknownValue";
    return type;
  }
  if (options?.unwrapInlineArray && typeof type === "object" && type !== null && "items" in type) return "ArrayValue";
  return type;
}

// ------------------------------------------------------------------ JSDoc extraction

function jsDocsOf(node: JSDocableNode): ReturnType<JSDocableNode["getJsDocs"]> {
  return node.getJsDocs();
}

/**
 * The TS JSDoc parser treats a mid-sentence `@word` (e.g. prose mentioning "@format") as a tag and
 * truncates `getDescription()` there. Reconstruct the description from the raw
 * comment text so only real line-start block tags terminate it, and trim each line (blank lines stay).
 */
function description(node: JSDocableNode): string {
  const docs = jsDocsOf(node);
  if (!docs.length) return "";
  const inner = docs[docs.length - 1].getText().replace(/^\/\*\*/, "").replace(/\*\/\s*$/, "");
  const lines = inner.split(/\r?\n/).map((l) => l.replace(/^\s*\*\s?/, "").trim());
  const tagIdx = lines.findIndex((l) => /^@\w/.test(l.trim()));
  const descLines = tagIdx === -1 ? lines.slice() : lines.slice(0, tagIdx);
  while (descLines.length && descLines[0].trim() === "") descLines.shift();
  if (tagIdx === -1) while (descLines.length && descLines[descLines.length - 1].trim() === "") descLines.pop();
  return descLines.join("\n");
}

function tags(node: JSDocableNode) {
  return jsDocsOf(node).flatMap((d) => d.getTags());
}
function tagText(tag: { getCommentText(): string | undefined }): string {
  return tag.getCommentText() ?? "";
}
function formatTag(node: JSDocableNode): string | undefined {
  const t = tags(node).find((x) => x.getTagName() === "format");
  const v = t ? tagText(t).trim() : "";
  return v || undefined;
}
function summaryTag(node: JSDocableNode): string | undefined {
  const t = tags(node).find((x) => x.getTagName() === "summary");
  const v = t ? tagText(t).trim() : "";
  return v || undefined;
}
const VISIBILITY_VALUES: McpToolVisibility[] = ["model", "app"];
/**
 * Reads the `@visibility` JSDoc tag: space- or comma-separated scopes (`model`, `app`).
 * Unknown words are ignored; an empty or all-unknown tag yields `undefined` (host default
 * `["model", "app"]` applies).
 */
function visibilityTag(node: JSDocableNode): McpToolVisibility[] | undefined {
  const t = tags(node).find((x) => x.getTagName() === "visibility");
  if (!t) return undefined;
  const words = tagText(t).split(/[\s,]+/).map((w) => w.trim().toLowerCase()).filter(Boolean);
  const values = VISIBILITY_VALUES.filter((v) => words.includes(v));
  return values.length ? values : undefined;
}
function exampleTag(node: JSDocableNode): unknown | undefined {
  const t = tags(node).find((x) => x.getTagName() === "example");
  return t ? parseExampleDoc(tagText(t)) : undefined;
}
function paramDoc(method: MethodDeclaration, paramName: string): string {
  const tag = tags(method).find((t) => t.getTagName() === "param" && Node.isJSDocParameterTag(t) && t.getName() === paramName);
  return normalizeParamDescription(tag ? tagText(tag) : "");
}
function returnDoc(method: MethodDeclaration): string {
  const t = tags(method).find((x) => x.getTagName() === "returns" || x.getTagName() === "return");
  return t ? tagText(t).trim() : "";
}

/** Trim and remove a leading dash (with optional spaces) from `@param` doc text. */
function normalizeParamDescription(doc: string): string {
  return doc.trim().replace(/^\s*-\s*/, "").trim();
}

/**
 * Parses `@example` JSDoc text into a JSON-serializable value for OpenAPI / Swagger.
 * @param doc Raw `@example` JSDoc text.
 */
export function parseExampleDoc(doc: string): unknown | undefined {
  const trimmed = (doc ?? "").trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return parseExampleLiteral(trimmed);
  const firstLine = trimmed.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
  return firstLine === undefined ? undefined : parseExampleScalar(firstLine);
}
function parseExampleScalar(raw: string): unknown {
  const s = raw.trim();
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try {
      return JSON.parse(s.startsWith("'") ? `"${s.slice(1, -1)}"` : s);
    } catch {
      return s.slice(1, -1);
    }
  }
  return s;
}
function parseExampleLiteral(raw: string): unknown | undefined {
  const normalized = raw.trim().replace(/(\w+)\s*:/g, '"$1":').replace(/'/g, '"');
  try {
    return JSON.parse(normalized);
  } catch {
    return undefined;
  }
}

// ------------------------------------------------------------------ closure: type-reference resolution

function getDeclName(decl: TypeDecl): string {
  return (Node.isClassDeclaration(decl) || Node.isInterfaceDeclaration(decl) || Node.isTypeAliasDeclaration(decl))
    ? (decl.getName() ?? "")
    : "";
}

function isLibDecl(decl: Node): boolean {
  const fp = decl.getSourceFile().getFilePath().replace(/\\/g, "/");
  return /\/lib\.[^/]*\.d\.ts$/.test(fp) || /\/node_modules\/typescript\/lib\//.test(fp);
}

/** Resolve a `TypeReference` node to its user-land interface/type-alias/class declaration (else undefined). */
function resolveTypeDecl(typeRef: TypeNode): TypeDecl | undefined {
  if (!Node.isTypeReference(typeRef)) return undefined;
  return resolveSymbolDecl(typeRef.getTypeName().getSymbol());
}

/** Resolve an `extends`/`implements` expression identifier to its declaration. */
function resolveExprDecl(expr: Node): TypeDecl | undefined {
  return resolveSymbolDecl(expr.getSymbol());
}

function resolveSymbolDecl(symbol: ReturnType<Node["getSymbol"]>): TypeDecl | undefined {
  let sym = symbol;
  if (sym && (sym.getFlags() & ts.SymbolFlags.Alias)) {
    const aliased = sym.getAliasedSymbol();
    if (aliased) sym = aliased;
  }
  if (!sym) return undefined;
  for (const d of sym.getDeclarations()) {
    if ((Node.isInterfaceDeclaration(d) || Node.isTypeAliasDeclaration(d) || Node.isClassDeclaration(d)) && !isLibDecl(d)) {
      return d;
    }
  }
  return undefined;
}

/** All user-land type declarations referenced inside a type node (arrays, unions, generics, inline objects). */
function refDeclsInTypeNode(typeNode: TypeNode): TypeDecl[] {
  const out: TypeDecl[] = [];
  const visit = (n: Node): void => {
    if (Node.isTypeReference(n)) {
      const d = resolveTypeDecl(n);
      if (d && !toolsPath(d.getSourceFile().getFilePath())) out.push(d);
    }
    n.forEachChild(visit);
  };
  visit(typeNode);
  return out;
}

/** API-surface type references of a declaration (signatures + type defs — never method bodies). */
function collectExternalRefs(decl: TypeDecl): TypeDecl[] {
  const out: TypeDecl[] = [];
  const addNode = (tn: TypeNode | undefined): void => {
    if (tn) out.push(...refDeclsInTypeNode(tn));
  };
  if (Node.isClassDeclaration(decl)) {
    for (const m of decl.getMethods()) {
      if (isPrivateMember(m)) continue;
      addNode(m.getParameters()[0]?.getTypeNode());
      addNode(m.getReturnTypeNode());
    }
    for (const p of decl.getProperties()) if (!isPrivateMember(p)) addNode(p.getTypeNode());
    for (const i of decl.getImplements()) {
      const d = resolveExprDecl(i.getExpression());
      if (d && !toolsPath(d.getSourceFile().getFilePath())) out.push(d);
    }
  } else if (Node.isInterfaceDeclaration(decl)) {
    for (const p of decl.getProperties()) addNode(p.getTypeNode());
    for (const e of decl.getExtends()) {
      const d = resolveExprDecl(e.getExpression());
      if (d && !toolsPath(d.getSourceFile().getFilePath())) out.push(d);
    }
  } else {
    addNode(decl.getTypeNode());
  }
  return out;
}

/** Prefer richer registry entries (enum members or properties) when a name resolves more than once. */
function registerBestInfo(registry: Map<string, CodeType>, codeType: CodeType): void {
  if (!codeType.name) return;
  const score = (t: CodeType) => (t.enum?.length ?? 0) + t.properties.length;
  const existing = registry.get(codeType.name);
  if (!existing || score(codeType) > score(existing)) registry.set(codeType.name, codeType);
}
