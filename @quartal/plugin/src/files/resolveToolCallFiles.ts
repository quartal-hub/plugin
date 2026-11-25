import type { FileStaging, FileStagingCall, FileTransferTarget, McpFile } from "../model/index.ts";
import { base64ToBytes } from "../hub/base64.ts";

/** The MCP files extension id. */
export const FILES_EXTENSION_ID = "io.modelcontextprotocol/files";
/** The JSON Schema keyword that marks a file argument. */
export const FILE_SCHEMA_KEYWORD = "x-mcp-file";

/** One file argument of a tool, from its input schema. */
export interface FileArgument {
  /** The top-level argument name. */
  name: string;
  /** The argument is an array of files. */
  array: boolean;
  /** Accepted MIME types or `.ext` extensions. */
  accept?: string[];
  /** Maximum size of one file in bytes. */
  maxSize?: number;
}

/**
 * The file arguments of a tool: top-level properties (or arrays of them) marked `x-mcp-file`.
 * @param inputSchema The tool's input schema.
 */
export function fileArguments(inputSchema: Record<string, unknown>): FileArgument[] {
  const properties = (inputSchema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const out: FileArgument[] = [];
  for (const [name, prop] of Object.entries(properties)) {
    const items = prop.type === "array" ? (prop.items as Record<string, unknown> | undefined) : undefined;
    const marked = (items ?? prop)[FILE_SCHEMA_KEYWORD] as { accept?: string[]; maxSize?: number } | undefined;
    if (!marked) continue;
    out.push({ name, array: !!items, ...(marked.accept ? { accept: marked.accept } : {}), ...(marked.maxSize ? { maxSize: marked.maxSize } : {}) });
  }
  return out;
}

/** What a request-state carries between the upload request and the retry. */
export interface FileUploadState {
  /** The tool name. */
  tool: string;
  /** SHA-256 (hex) of the canonical JSON of the arguments. */
  args: string;
  /** SHA-256 (hex) of the caller's `Authorization` header. */
  principal: string;
  /** Staging keys by file id. */
  files: Record<string, string>;
}

/** Inputs of {@link resolveToolCallFiles}. */
export interface ResolveFilesInput {
  tool: string;
  args: Record<string, unknown>;
  fileArgs: FileArgument[];
  headers: Record<string, string>;
  /** The client declared `upload`. */
  clientUpload: boolean;
  /** Inline bytes accepted per request (the `maxInlineBytes` the server declares). */
  maxInlineBytes: number;
  staging?: FileStaging;
  /** Seals the request-state (absent: no out-of-band uploads). */
  mintState?: (state: FileUploadState) => Promise<string>;
  /** The verified request-state of a retry. */
  state?: FileUploadState;
  /** Runs a staging call with the caller's context (resolved like for the tool itself). */
  withCall?: <T>(fn: (call: FileStagingCall) => Promise<T>) => Promise<T>;
}

/** The outcome of {@link resolveToolCallFiles}. */
export type ResolveFilesOutcome =
  | { kind: "ready"; bytes: Map<string, Uint8Array>; staged: Map<string, string> }
  | { kind: "upload"; uploads: (FileTransferTarget & { fileId: string })[]; requestState: string }
  | { kind: "missing-capability" }
  | { kind: "mismatch"; message: string }
  | { kind: "refused"; message: string };

/**
 * Receives the files of one tool call (MCP files extension): inline `data` is decoded and checked;
 * files to be uploaded get staging targets and an upload request (first call), or are read back
 * from staging and checked (retry with the request-state). Size, accepted type and — when given —
 * the SHA-256 digest are verified before the tool may run.
 * @param input The call.
 */
export async function resolveToolCallFiles(input: ResolveFilesInput): Promise<ResolveFilesOutcome> {
  const files = collectFiles(input.args, input.fileArgs);
  const bytes = new Map<string, Uint8Array>();
  const staged = new Map<string, string>();
  if (files.length === 0) return { kind: "ready", bytes, staged };

  const ids = new Set<string>();
  let inlineTotal = 0;
  const pending: McpFile[] = [];
  for (const { arg, file } of files) {
    if (ids.has(file.id)) return { kind: "refused", message: `Two files share the id "${file.id}".` };
    ids.add(file.id);
    const problem = metadataProblem(arg, file);
    if (problem) return { kind: "refused", message: problem };
    if (file.size === 0) {
      bytes.set(file.id, new Uint8Array());
      continue;
    }
    if (file.data !== undefined) {
      let decoded: Uint8Array;
      try {
        decoded = base64ToBytes(String(file.data));
      } catch {
        return { kind: "refused", message: `File "${label(file)}" has undecodable inline data.` };
      }
      inlineTotal += decoded.length;
      if (inlineTotal > input.maxInlineBytes) {
        return { kind: "refused", message: `Inline files exceed ${input.maxInlineBytes} bytes; upload them instead.` };
      }
      const check = await bytesProblem(file, decoded);
      if (check) return { kind: "refused", message: check };
      bytes.set(file.id, decoded);
      continue;
    }
    pending.push(file);
  }
  if (pending.length === 0) return { kind: "ready", bytes, staged };

  const withCall = input.withCall ?? (<T>(fn: (call: FileStagingCall) => Promise<T>) =>
    fn({ tool: input.tool, args: input.args, ctx: { authenticated: false } }));
  const argsHash = await sha256Hex(canonicalJson(input.args));
  const principal = await sha256Hex(input.headers.authorization ?? input.headers.Authorization ?? "");

  if (input.state) {
    const { state } = input;
    if (state.tool !== input.tool || state.args !== argsHash || state.principal !== principal) {
      return { kind: "mismatch", message: "The request state belongs to another call." };
    }
    const staging = input.staging;
    for (const file of pending) {
      const key = state.files[file.id];
      if (!key || !staging) return { kind: "refused", message: `File "${label(file)}" did not arrive.` };
      if (staging.confirm) {
        const ok = await withCall((call) => staging.confirm!(key, file, call));
        if (!ok) return { kind: "refused", message: `File "${label(file)}" did not arrive, or does not match its size or digest.` };
        staged.set(file.id, key);
        continue;
      }
      const received = staging.read ? await withCall((call) => staging.read!(key, call)) : undefined;
      if (!received) return { kind: "refused", message: `File "${label(file)}" did not arrive.` };
      const check = await bytesProblem(file, received);
      if (check) return { kind: "refused", message: check };
      bytes.set(file.id, received);
    }
    return { kind: "ready", bytes, staged };
  }

  if (!input.staging || !input.mintState || (!input.staging.read && !input.staging.confirm)) {
    return { kind: "refused", message: "This plugin accepts files only inline (base64 `data`)." };
  }
  if (!input.clientUpload) return { kind: "missing-capability" };

  const uploads: (FileTransferTarget & { fileId: string })[] = [];
  const keys: Record<string, string> = {};
  const staging = input.staging;
  for (const file of pending) {
    const { target, key } = await withCall((call) => staging.createUpload(file, call));
    uploads.push({ fileId: file.id, ...target });
    keys[file.id] = key;
  }
  const requestState = await input.mintState({ tool: input.tool, args: argsHash, principal, files: keys });
  return { kind: "upload", uploads, requestState };
}

function collectFiles(args: Record<string, unknown>, fileArgs: FileArgument[]): { arg: FileArgument; file: McpFile }[] {
  const out: { arg: FileArgument; file: McpFile }[] = [];
  for (const arg of fileArgs) {
    const value = args[arg.name];
    const values = arg.array ? (Array.isArray(value) ? value : []) : value === undefined || value === null ? [] : [value];
    for (const v of values) out.push({ arg, file: v as McpFile });
  }
  return out;
}

function label(file: McpFile): string {
  return file.name ?? file.id;
}

function metadataProblem(arg: FileArgument, file: McpFile): string | undefined {
  if (!Number.isInteger(file.size) || file.size < 0) return `File "${label(file)}" has an invalid size.`;
  if (arg.maxSize !== undefined && file.size > arg.maxSize) {
    return `File "${label(file)}" is ${file.size} bytes; at most ${arg.maxSize} are accepted.`;
  }
  if (arg.accept?.length && !accepted(file, arg.accept)) {
    return `File "${label(file)}" (${file.mimeType}) is not one of the accepted types: ${arg.accept.join(", ")}.`;
  }
  return undefined;
}

function accepted(file: McpFile, accept: string[]): boolean {
  const type = file.mimeType.split(";")[0].trim().toLowerCase();
  const name = (file.name ?? "").toLowerCase();
  return accept.some((raw) => {
    const a = raw.trim().toLowerCase();
    if (a.startsWith(".")) return name.endsWith(a);
    if (a.endsWith("/*")) return type.startsWith(a.slice(0, -1));
    return type === a;
  });
}

async function bytesProblem(file: McpFile, data: Uint8Array): Promise<string | undefined> {
  if (data.length !== file.size) return `File "${label(file)}" is ${data.length} bytes, not the declared ${file.size}.`;
  if (file.digest) {
    const actual = await sha256Base64Url(data);
    if (actual !== file.digest.value) return `File "${label(file)}" does not match its SHA-256 digest.`;
  }
  return undefined;
}

/** JSON with object keys sorted, so equal arguments hash equally whatever their member order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value as Record<string, unknown>).sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data as Uint8Array<ArrayBuffer>));
}

async function sha256Hex(text: string): Promise<string> {
  const hash = await sha256(new TextEncoder().encode(text));
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 of bytes as base64url without padding (the files extension's digest encoding). */
export async function sha256Base64Url(data: Uint8Array): Promise<string> {
  const hash = await sha256(data);
  let binary = "";
  for (const b of hash) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
