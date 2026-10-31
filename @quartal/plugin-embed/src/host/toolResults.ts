import type { CallToolResult, ContentBlock } from "../model/index.ts";

/**
 * Wraps a tool's JSON result as an MCP `CallToolResult`: the value as `structuredContent` plus its
 * serialized text, the shape Quartal plugins return from MCP `tools/call`. A non-object value is
 * wrapped as `{ value }`, as plugins do.
 * @param value The tool's JSON result.
 */
export function jsonToolResult(value: unknown): CallToolResult {
  const structured = value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : { value: value ?? null };
  return { structuredContent: structured, content: [{ type: "text", text: JSON.stringify(structured) }] };
}

/**
 * An MCP `CallToolResult` reporting a tool execution error (`isError: true`, message as text).
 * @param message Human-readable error message.
 */
export function errorToolResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** The first `type: "text"` block of a result's content. */
function firstText(content: readonly ContentBlock[] | undefined): string | undefined {
  for (const block of content ?? []) {
    if (block?.type === "text" && typeof block.text === "string") return block.text;
  }
  return undefined;
}

/**
 * Reads a `CallToolResult`: the JSON value (`structuredContent` first, then the first text block,
 * JSON-parsed when possible), or the error message of an `isError` result.
 * @param result The tool result.
 */
export function readToolResult(result: CallToolResult): { value?: unknown; error?: string } {
  if (result.isError) {
    const text = firstText(result.content) ?? "Tool execution failed.";
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object" && typeof (parsed as { error?: unknown }).error === "string") {
        return { error: (parsed as { error: string }).error };
      }
    } catch {
      // Plain-text message.
    }
    return { error: text };
  }
  if (result.structuredContent !== undefined) return { value: result.structuredContent };
  const text = firstText(result.content);
  if (text === undefined) return { value: undefined };
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { value: text };
  }
}
