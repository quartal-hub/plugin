import { html, raw } from "hono/html";
import type { CodeArrayType, CodeClass, CodeFile, CodeFunction, CodeOrSystemType, CodePropOrParam, CodeType } from "../model/index.ts";

/**
 * Renders CodeFile[] (from TsMorphAnalyzer) to HTML.
 * Renders classes and types as separate lists with links from classes to types.
 */
export class CodeFileRenderer {
  /** All type names (including Anon[n]) for linking. */
  private typeNames = new Set<string>();
  /** Type name -> CodeType for expanding object parameter properties. */
  private typeByName = new Map<string, CodeType>();

  /**
   * Render a list of analyzed code files to HTML.
   * This is used on the hub front page to show a compact API overview.
   * @param files Analyzed code files to render.
   */
  render(files: CodeFile[]): ReturnType<typeof html> {
    this.typeNames = new Set<string>();
    this.typeByName = new Map<string, CodeType>();
    for (const file of files) {
      for (const t of file.types) {
        this.typeNames.add(t.name);
        this.typeByName.set(t.name, t);
      }
    }

    const classesHtml = this.renderClassesSection(files);
    const typesHtml = this.renderTypesSection(files);

    return html`
      <div class="mt-3">
        <h5>API Documentation</h5>
        ${raw(classesHtml)} ${raw(typesHtml)}
      </div>
    `;
  }

  private renderClassesSection(files: CodeFile[]): string {
    const classItems: string[] = [];
    for (const file of files) {
      for (const c of file.classes) {
        classItems.push(this.renderClass(c));
      }
    }
    if (classItems.length === 0) return "";
    return `<section class="mb-4"><h2 class="text-primary">Classes</h2>${classItems.join("")}</section>`;
  }

  private renderTypesSection(files: CodeFile[]): string {
    const typeItems: string[] = [];
    for (const file of files) {
      for (const t of file.types) {
        typeItems.push(this.renderType(t));
      }
    }
    if (typeItems.length === 0) return "";
    return `<section class="mb-4"><h2 class="text-primary">Types</h2>${typeItems.join("")}</section>`;
  }

  private renderClass(c: CodeClass): string {
    const id = this.classId(c.name);
    const desc = c.description ? `<div class="description-text">${this.escape(c.description)}</div>` : "";
    const funcs = c.functions.map((f) => this.renderFunction(f)).join("");
    const props = c.properties.length > 0 ? this.renderPropsTable(c.properties) : "";
    const impl = c.implements.length > 0
      ? ` <div class="text-muted">implements ${c.implements.map((i) => this.typeLink(i)).join(", ")}</div>`
      : "";
    return `<h3 id="${id}">${this.escape(c.name)}</h3>${impl}${desc}${funcs ? `<div>${funcs}</div>` : ""}${props}`;
  }

  private renderPropsTable(props: CodePropOrParam[]): string {
    const rows = props.map((p) => {
      const typeStr = this.formatType(p.type);
      const name = `${p.name}${p.optional ? "?" : ""}`;
      const format = p.format ? `<div class="text-muted"><small>format: <code>${this.escape(p.format)}</code></small></div>` : "";
      return `<tr><td><code>${this.escape(name)}</code></td><td>${typeStr}</td><td><div class="description-text">${
        this.escape(p.description)
      }</div>${format}</td></tr>`;
    }).join("");
    return `<table class="table table-sm table-properties mt-1 mb-0"><thead><tr><th colspan="3">Properties</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  private renderFunction(f: CodeFunction): string {
    const staticBadge = f.isStatic ? ' <small class="text-muted">static </small>' : "";
    const paramRows: string[] = [];
    for (const p of f.parameters) {
      const typeStr = this.formatType(p.type);
      const name = `${p.name}${p.optional ? "?" : ""}`;
      const format = p.format ? `<div class="text-muted"><small>format: <code>${this.escape(p.format)}</code></small></div>` : "";
      paramRows.push(
        `<tr><td><code>${this.escape(name)}</code></td><td>${typeStr}</td><td colspan="2"><div class="description-text">${
          this.escape(p.description)
        }</div>${format}</td></tr>`,
      );
      const objType = this.getCodeType(p.type);
      if (objType?.properties?.length) {
        for (const prop of objType.properties) {
          const propTypeStr = this.formatType(prop.type);
          const propName = `${prop.name}${prop.optional ? "?" : ""}`;
          const propFormat = prop.format
            ? `<div class="text-muted"><small>format: <code>${this.escape(prop.format)}</code></small></div>`
            : "";
          paramRows.push(
            `<tr><td></td><td class="ps-3"><code>${
              this.escape(propName)
            }</code></td><td>${propTypeStr}</td><td><div class="description-text">${
              this.escape(prop.description)
            }</div>${propFormat}</td></tr>`,
          );
        }
      }
    }
    const returnRow = `<tr><td><em>returns</em></td><td>${
      this.formatType(f.returns.type)
    }</td><td colspan="2"><div class="description-text">${this.escape(f.returns.description)}</div></td></tr>`;
    const table = `<table class="table table-sm table-parameters mt-1 mb-3"><thead><tr><th colspan="4">Parameters</th></tr></thead><tbody>${
      paramRows.join("")
    }${returnRow}</tbody></table>`;
    return `<h4 class="mt-2">${staticBadge}<strong>${this.escape(f.name)}()</strong></h4><div class="description-text">${
      this.escape(f.description)
    }</div>${table}`;
  }

  /** If the type is a CodeType (object with properties), return it; for string type names look up in typeByName. */
  private getCodeType(type: CodeOrSystemType): CodeType | undefined {
    if (typeof type === "object" && type !== null && "name" in type && "properties" in type) {
      return type as CodeType;
    }
    if (typeof type === "string") {
      return this.typeByName.get(type);
    }
    return undefined;
  }

  private renderType(t: CodeType): string {
    const id = this.typeId(t.name);
    const desc = t.description ? `<div class="description-text">${this.escape(t.description)}</div>` : "";
    const ext = t.extends.length > 0 ? ` <div class="text-muted">extends ${t.extends.map((e) => this.typeLink(e)).join(", ")}</div>` : "";
    const props = t.properties.length > 0 ? this.renderPropsTable(t.properties) : "";
    return `<h3 id="${id}">${this.escape(t.name)}</h3>${ext}${desc}${props}`;
  }

  private formatType(type: CodeOrSystemType): string {
    if (typeof type === "string") return this.typeLink(type);
    if (typeof type === "object" && type !== null) {
      if ("name" in type && "properties" in type) {
        return this.typeLink((type as CodeType).name);
      }
      if ("items" in type) {
        const arr = type as CodeArrayType;
        return `${this.formatType(arr.items)}[]`;
      }
    }
    return this.escape(String(type));
  }

  private typeLink(name: string): string {
    if (this.typeNames.has(name)) {
      return `<a href="#${this.typeId(name)}" class="text-decoration-none type-link">${this.escape(name)}</a>`;
    }
    return `<span class="text-muted type-link">${this.escape(name)}</span>`;
  }

  private classId(name: string): string {
    return `class-${name.replace(/\s+/g, "-")}`;
  }

  private typeId(name: string): string {
    return `type-${name.replace(/\s+/g, "-")}`;
  }

  private escape(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}
