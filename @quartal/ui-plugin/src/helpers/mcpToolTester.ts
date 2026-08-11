import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Implementation, Tool } from "@modelcontextprotocol/sdk/types.js";
import { getToolUiResourceUri } from "@modelcontextprotocol/ext-apps/app-bridge";

/** A loose JSON Schema object (as advertised by MCP `tools/list#inputSchema`). */
export type JsonSchema = Record<string, unknown>;

/**
 * A structural MCP `CallToolResult`. We keep our own loose shape (rather than the SDK's
 * zod-inferred type) so it can cross Vue component-prop boundaries without the "two different
 * types with this name" identity mismatches vue-tsc produces for deep inferred types.
 */
export interface McpToolResult {
  /** Content blocks (text/image/resource/…). */
  content?: Array<Record<string, unknown>>;
  /** Structured JSON result, when the tool provides one. */
  structuredContent?: unknown;
  /** Whether the tool reported an error. */
  isError?: boolean;
  /** Forward-compatible extra fields. */
  [key: string]: unknown;
}

/** A single MCP tool, normalized for the tester UI. */
export interface McpToolInfo {
  /** MCP tool id (`tools/list` name). */
  name: string;
  /** Short display title (MCP `title`, typically from `@summary`). */
  title?: string;
  /** Longer description from the tool's JSDoc. */
  description?: string;
  /** JSON Schema for the tool's arguments. */
  inputSchema: JsonSchema;
  /** `ui://` resource URI of the tool's MCP Apps widget, when one is registered. */
  resourceUri?: string;
}

/** Default host identity reported to the MCP server. */
const DEFAULT_CLIENT_INFO: Implementation = { name: "McpToolTester", version: "0.1.0" };

/**
 * Connects an MCP {@link Client} to a Streamable HTTP endpoint (e.g. `https://anon.salaxy.com/mcp`).
 * @param serverUrl Absolute URL of the MCP endpoint.
 * @param clientInfo Optional client identity reported in the initialize handshake.
 */
export async function connectMcpClient(
  serverUrl: string,
  clientInfo: Implementation = DEFAULT_CLIENT_INFO,
): Promise<Client> {
  const client = new Client(clientInfo, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(serverUrl));
  await client.connect(transport);
  return client;
}

/** Normalizes a raw MCP {@link Tool} into an {@link McpToolInfo}. */
function toToolInfo(tool: Tool): McpToolInfo {
  let resourceUri: string | undefined;
  try {
    resourceUri = getToolUiResourceUri(tool);
  } catch {
    // An invalid `_meta.ui.resourceUri` just means "no previewable widget" for the tester.
    resourceUri = undefined;
  }
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: (tool.inputSchema ?? { type: "object" }) as JsonSchema,
    resourceUri,
  };
}

/** Lists the tools exposed by an MCP server, flagging those that carry a widget. */
export async function listMcpTools(client: Client): Promise<McpToolInfo[]> {
  const { tools } = await client.listTools();
  return tools.map(toToolInfo);
}

/** Reads the self-contained HTML of a widget resource via `resources/read`.
 * @param client Connected MCP client.
 * @param uri `ui://` resource URI of the widget.
 */
export async function readWidgetHtml(client: Client, uri: string): Promise<string> {
  const { contents } = await client.readResource({ uri });
  for (const content of contents) {
    if ("text" in content && typeof content.text === "string") {
      return content.text;
    }
  }
  throw new Error(`Widget resource ${uri} has no HTML text content.`);
}

/** Input control the tester renders for a top-level schema property. */
export type FormControl = "string" | "number" | "integer" | "boolean" | "date" | "datetime" | "enum" | "json";

/** A generated form field for one top-level property of a tool's input schema. */
export interface FormField {
  /** Property name. */
  name: string;
  /** Control to render. */
  control: FormControl;
  /** Whether the property is listed in the schema's `required`. */
  required: boolean;
  /** Property description from JSDoc, if any. */
  description?: string;
  /** Allowed values when {@link control} is `"enum"`. */
  enumValues?: string[];
  /** Human-readable type label for the field header. */
  typeLabel: string;
  /** The property's raw sub-schema. */
  schema: JsonSchema;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Returns the primary `type` of a schema (first non-null when `type` is an array). */
function schemaType(schema: JsonSchema): string | undefined {
  const t = schema.type;
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return t.find((x) => typeof x === "string" && x !== "null") as string | undefined;
  return undefined;
}

/** Picks the control used to edit a schema property. */
function controlForSchema(schema: JsonSchema): FormControl {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return "enum";
  const type = schemaType(schema);
  switch (type) {
    case "boolean":
      return "boolean";
    case "integer":
      return "integer";
    case "number":
      return "number";
    case "string": {
      const format = typeof schema.format === "string" ? schema.format : undefined;
      if (format === "date") return "date";
      if (format === "date-time") return "datetime";
      return "string";
    }
    default:
      // Objects, arrays, unions (oneOf/anyOf) and untyped schemas are edited as raw JSON.
      return "json";
  }
}

/** Short type label shown in the field header (e.g. `string`, `number`, `Period (object)`). */
function typeLabelForSchema(schema: JsonSchema, control: FormControl): string {
  if (control === "enum") return "enum";
  if (control === "json") {
    const type = schemaType(schema);
    if (type === "array") return "array (JSON)";
    if (type === "object") return "object (JSON)";
    if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) return "union (JSON)";
    return "JSON";
  }
  if (control === "date") return "string · date";
  if (control === "datetime") return "string · date-time";
  return control;
}

/** Builds the ordered list of form fields for a tool's top-level input properties. */
export function buildFormFields(inputSchema: JsonSchema): FormField[] {
  const properties = asRecord(inputSchema.properties);
  const required = new Set(Array.isArray(inputSchema.required) ? (inputSchema.required as string[]) : []);
  return Object.entries(properties).map(([name, raw]) => {
    const schema = asRecord(raw);
    const control = controlForSchema(schema);
    return {
      name,
      control,
      required: required.has(name),
      description: typeof schema.description === "string" ? schema.description : undefined,
      enumValues: control === "enum" ? (schema.enum as unknown[]).map((v) => String(v)) : undefined,
      typeLabel: typeLabelForSchema(schema, control),
      schema,
    };
  });
}

/** Returns an example/default value declared on a schema, if any (`example`, `examples[0]`, `default`). */
function declaredExample(schema: JsonSchema): unknown {
  if (schema.example !== undefined) return schema.example;
  if (Array.isArray(schema.examples) && schema.examples.length > 0) return schema.examples[0];
  if (schema.default !== undefined) return schema.default;
  return undefined;
}

/** Builds a placeholder value for a property that has no declared example. */
function placeholderFor(schema: JsonSchema): unknown {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  switch (schemaType(schema)) {
    case "boolean":
      return false;
    case "integer":
    case "number":
      return 0;
    case "array":
      return [];
    case "object":
      return {};
    case "string":
      return "";
    default:
      return "";
  }
}

/**
 * Builds an example arguments object for a tool, preferring values declared in the type
 * documentation (`@example`, `@default`) and falling back to typed placeholders.
 * @param inputSchema The tool's input JSON Schema.
 */
export function buildExampleArgs(inputSchema: JsonSchema): Record<string, unknown> {
  // A whole-object example on the (unwrapped) parameter wins outright.
  const whole = declaredExample(inputSchema);
  if (whole && typeof whole === "object" && !Array.isArray(whole)) {
    return whole as Record<string, unknown>;
  }
  const properties = asRecord(inputSchema.properties);
  const out: Record<string, unknown> = {};
  for (const [name, raw] of Object.entries(properties)) {
    const schema = asRecord(raw);
    const example = declaredExample(schema);
    out[name] = example !== undefined ? example : placeholderFor(schema);
  }
  return out;
}

/** Pretty-prints a value as JSON, tolerating cyclic/unserializable input. */
export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** A form model: raw editor state keyed by property name (strings, booleans, or JSON text). */
export type FormModel = Record<string, unknown>;

/** Initializes the form model from an example arguments object. */
export function initFormModel(fields: FormField[], example: Record<string, unknown>): FormModel {
  const model: FormModel = {};
  for (const field of fields) {
    const value = example[field.name];
    if (field.control === "boolean") {
      model[field.name] = value === true;
    } else if (field.control === "json") {
      model[field.name] = value !== undefined ? prettyJson(value) : "";
    } else {
      model[field.name] = value !== undefined && value !== null ? String(value) : "";
    }
  }
  return model;
}

/** Coerces a single field's editor value into the JSON value the tool expects. */
function coerceFieldValue(field: FormField, raw: unknown): unknown {
  switch (field.control) {
    case "boolean":
      return raw === true;
    case "integer":
    case "number": {
      if (raw === "" || raw == null) return undefined;
      const num = Number(raw);
      if (Number.isNaN(num)) throw new Error(`"${field.name}" must be a number`);
      return num;
    }
    case "json": {
      const text = typeof raw === "string" ? raw.trim() : "";
      if (text === "") return undefined;
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error(`"${field.name}" is not valid JSON: ${(e as Error).message}`);
      }
    }
    default: {
      // string / date / datetime / enum
      if (raw === "" || raw == null) return undefined;
      return raw;
    }
  }
}

/**
 * Assembles a tool arguments object from the generated form, coercing types and dropping
 * empty optional fields.
 * @param fields Form fields for the selected tool.
 * @param model Current editor state.
 */
export function buildArgsFromForm(fields: FormField[], model: FormModel): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const field of fields) {
    const value = coerceFieldValue(field, model[field.name]);
    if (value === undefined) {
      if (field.required) {
        throw new Error(`"${field.name}" is required`);
      }
      continue;
    }
    args[field.name] = value;
  }
  return args;
}

/** Extracts the first text block of a tool result as a parsed value (or the raw string). */
export function toolResultToValue(result: McpToolResult): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;
  const textBlock = result.content?.find((c) => c.type === "text");
  if (textBlock && typeof textBlock.text === "string") {
    try {
      return JSON.parse(textBlock.text);
    } catch {
      return textBlock.text;
    }
  }
  return result.content;
}
