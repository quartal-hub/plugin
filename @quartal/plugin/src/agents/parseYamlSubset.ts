/** A value produced by {@link parseYamlSubset}. */
export type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

/** One source line, kept in document order (blank and comment lines included). */
interface YamlLine {
  /** Number of leading spaces (tabs count as two). */
  indent: number;
  /** Line content with indentation stripped. */
  text: string;
  /** True for blank lines and whole-line comments — skipped by the structural parser. */
  skip: boolean;
}

const BLOCK_SCALAR_RE = /^([|>])([+-]?)$/;

/** Splits the document into lines, tagging the ones the structural parser ignores. */
function toLines(text: string): YamlLine[] {
  return text.replaceAll("\r\n", "\n").split("\n").map((raw) => {
    const line = raw.replaceAll("\t", "  ");
    const trimmed = line.trim();
    return {
      indent: line.length - line.trimStart().length,
      text: trimmed,
      skip: trimmed === "" || trimmed.startsWith("#"),
    };
  });
}

/** Index of the next structural line at or after `from`, or `lines.length`. */
function nextSignificant(lines: YamlLine[], from: number): number {
  let i = from;
  while (i < lines.length && lines[i].skip) i++;
  return i;
}

/** Strips a wrapping pair of single or double quotes. */
function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      const inner = value.slice(1, -1);
      return first === '"' ? inner.replaceAll("\\n", "\n").replaceAll('\\"', '"') : inner.replaceAll("''", "'");
    }
  }
  return value;
}

/** Converts an unquoted scalar to boolean/number/null where YAML would. */
function coerceScalar(raw: string): YamlValue {
  const value = raw.trim();
  if (value === "") return "";
  if (value.startsWith('"') || value.startsWith("'")) return unquote(value);
  if (value === "true" || value === "false") return value === "true";
  if (value === "null" || value === "~") return null;
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d*\.\d+$/.test(value)) return Number.parseFloat(value);
  return value;
}

/** Splits on commas that are not inside quotes. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ",") {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Index of the `key: value` separator, ignoring colons inside quotes and inside `https://…`. */
function indexOfSeparator(text: string): number {
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ":" && (i + 1 === text.length || text[i + 1] === " ")) {
      return i;
    }
  }
  return -1;
}

/** Parses a `[a, b, c]` flow sequence (scalar items only). */
function parseFlowSequence(raw: string): YamlValue[] {
  const inner = raw.slice(1, -1).trim();
  return inner ? splitTopLevel(inner).map(coerceScalar) : [];
}

/** Parses a `{a: 1, b: 2}` flow mapping (scalar values only). */
function parseFlowMapping(raw: string): Record<string, YamlValue> {
  const result: Record<string, YamlValue> = {};
  const inner = raw.slice(1, -1).trim();
  if (!inner) return result;
  for (const part of splitTopLevel(inner)) {
    const colon = indexOfSeparator(part);
    if (colon === -1) continue;
    result[unquote(part.slice(0, colon).trim())] = coerceScalar(part.slice(colon + 1));
  }
  return result;
}

/** Parses an inline value (everything after `key:` or `- ` on the same line). */
function parseInline(text: string): YamlValue {
  if (text.startsWith("[") && text.endsWith("]")) return parseFlowSequence(text);
  if (text.startsWith("{") && text.endsWith("}")) return parseFlowMapping(text);
  return coerceScalar(text);
}

/** Folds a `>` block scalar: single newlines become spaces, blank lines stay newlines. */
function foldLines(lines: string[]): string {
  let out = "";
  for (const line of lines) {
    if (line === "") {
      out += "\n";
    } else {
      if (out && !out.endsWith("\n")) out += " ";
      out += line;
    }
  }
  return out;
}

/** Reads a `|` / `>` block scalar: every line indented deeper than `indent`. */
function readBlockScalar(
  lines: YamlLine[],
  start: number,
  indent: number,
  style: "|" | ">",
  chomp: string,
): { value: string; next: number } {
  const collected: string[] = [];
  let blockIndent = -1;
  let i = start;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.text === "") {
      collected.push("");
      continue;
    }
    if (line.indent <= indent) break;
    if (blockIndent === -1) blockIndent = line.indent;
    collected.push(" ".repeat(Math.max(0, line.indent - blockIndent)) + line.text);
  }
  while (collected.length > 0 && collected[collected.length - 1] === "") collected.pop();

  const body = style === "|" ? collected.join("\n") : foldLines(collected);
  return { value: chomp === "-" ? body : body + "\n", next: i };
}

/** Parses a block (mapping or sequence) whose entries start at column `indent`. */
function parseBlock(lines: YamlLine[], start: number, indent: number): { value: YamlValue; next: number } {
  const text = lines[start].text;
  return text === "-" || text.startsWith("- ")
    ? parseSequence(lines, start, indent)
    : parseMapping(lines, start, indent);
}

function parseSequence(lines: YamlLine[], start: number, indent: number): { value: YamlValue[]; next: number } {
  const items: YamlValue[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.skip) {
      i++;
      continue;
    }
    if (line.indent !== indent || (line.text !== "-" && !line.text.startsWith("- "))) break;

    const content = line.text === "-" ? "" : line.text.slice(2).trim();
    const next = nextSignificant(lines, i + 1);
    if (content === "") {
      // A bare `-`: the item is the deeper block that follows.
      if (next < lines.length && lines[next].indent > indent) {
        const nested = parseBlock(lines, next, lines[next].indent);
        items.push(nested.value);
        i = nested.next;
      } else {
        items.push(null);
        i = next;
      }
      continue;
    }
    if (indexOfSeparator(content) !== -1) {
      // `- key: value` opens a mapping; deeper lines belong to the same item.
      const itemIndent = indent + 2;
      const inline: YamlLine[] = [{ indent: itemIndent, text: content, skip: false }];
      let j = next;
      while (j < lines.length && (lines[j].skip || (lines[j].indent > indent && !lines[j].text.startsWith("- ")))) {
        if (!lines[j].skip) inline.push({ indent: itemIndent, text: lines[j].text, skip: false });
        j++;
      }
      items.push(parseMapping(inline, 0, itemIndent).value);
      i = j;
      continue;
    }
    items.push(parseInline(content));
    i = next;
  }
  return { value: items, next: i };
}

function parseMapping(
  lines: YamlLine[],
  start: number,
  indent: number,
): { value: Record<string, YamlValue>; next: number } {
  const map: Record<string, YamlValue> = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.skip) {
      i++;
      continue;
    }
    if (line.indent !== indent || line.text.startsWith("- ")) break;

    const colon = indexOfSeparator(line.text);
    if (colon === -1) {
      i++;
      continue;
    }
    const key = unquote(line.text.slice(0, colon).trim());
    const rest = line.text.slice(colon + 1).trim();
    const block = BLOCK_SCALAR_RE.exec(rest);

    if (block) {
      const scalar = readBlockScalar(lines, i + 1, indent, block[1] as "|" | ">", block[2]);
      map[key] = scalar.value;
      i = scalar.next;
      continue;
    }
    if (rest === "") {
      const next = nextSignificant(lines, i + 1);
      if (next < lines.length && lines[next].indent > indent) {
        const nested = parseBlock(lines, next, lines[next].indent);
        map[key] = nested.value;
        i = nested.next;
      } else {
        map[key] = "";
        i = next;
      }
      continue;
    }
    map[key] = parseInline(rest);
    i++;
  }
  return { value: map, next: i };
}

/**
 * Parses the YAML subset used by agent frontmatter into a plain object.
 *
 * Supported: `key: value` mappings, nested mappings by indentation, block sequences (`- item` and
 * `- key: value`), flow sequences (`[a, b]`) and flow mappings (`{a: 1}`), quoted strings,
 * numbers, booleans, `null`, and `|` / `>` block scalars. Anchors, tags, multi-document streams
 * and complex keys are not supported — agent frontmatter never needs them, and a full YAML parser
 * is not worth a runtime dependency in a published package.
 * @param text YAML text (the content between the `---` fences).
 */
export function parseYamlSubset(text: string): Record<string, YamlValue> {
  const lines = toLines(text);
  const first = nextSignificant(lines, 0);
  if (first >= lines.length) return {};
  const parsed = parseMapping(lines, first, lines[first].indent);
  return parsed.value;
}
