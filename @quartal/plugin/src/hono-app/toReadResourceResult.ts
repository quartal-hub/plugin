import type { McpResourceDescriptor } from "../model/index.ts";
import { bytesToBase64 } from "../hub/base64.ts";

/** One item of a `resources/read` result. */
type ResourceContent = { uri: string; mimeType: string; text: string } | { uri: string; mimeType: string; blob: string };

/**
 * Turns what a resource method returned into a `resources/read` result:
 * a string is text (`@mimeType`, default `text/plain`); bytes are a base64 blob (default
 * `application/octet-stream`); `{ text }` / `{ blob }` objects may set their own `mimeType`
 * (`blob` as bytes or base64); an object with a `contents` array passes through; anything else is
 * served as JSON.
 * @param descriptor The resource.
 * @param uri The URI that was read (a template expanded).
 * @param value What the resource method returned.
 */
export function toReadResourceResult(
  descriptor: McpResourceDescriptor,
  uri: string,
  value: unknown,
): { contents: ResourceContent[] } {
  if (typeof value === "string") {
    return { contents: [{ uri, mimeType: descriptor.mimeType ?? "text/plain", text: value }] };
  }
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    return { contents: [{ uri, mimeType: descriptor.mimeType ?? "application/octet-stream", blob: bytesToBase64(bytes) }] };
  }
  if (value && typeof value === "object") {
    const obj = value as { contents?: unknown; text?: unknown; blob?: unknown; mimeType?: unknown };
    if (Array.isArray(obj.contents)) return value as { contents: ResourceContent[] };
    const mimeType = typeof obj.mimeType === "string" ? obj.mimeType : descriptor.mimeType;
    if (typeof obj.text === "string") {
      return { contents: [{ uri, mimeType: mimeType ?? "text/plain", text: obj.text }] };
    }
    if (obj.blob instanceof Uint8Array || typeof obj.blob === "string") {
      const blob = obj.blob instanceof Uint8Array ? bytesToBase64(obj.blob) : obj.blob;
      return { contents: [{ uri, mimeType: mimeType ?? "application/octet-stream", blob }] };
    }
  }
  return {
    contents: [{ uri, mimeType: descriptor.mimeType ?? "application/json", text: JSON.stringify(value ?? null) }],
  };
}
