/** The answer of a tool called with {@link callPluginTool}. */
export interface PluginToolResult {
  ok: boolean;
  /** `structuredContent` when the tool returned it, otherwise the text content. */
  value: unknown;
}

/**
 * Calls a tool of another Quartal Plugin over MCP (`tools/call` on `<pluginUrl>/mcp`).
 *
 * The receiver's MCP tool name is stable, unlike its REST path, which depends on `@rest` tags.
 * `PluginClient` in `@quartal/plugin-core` would get this as `callTool()`; see `docs/events.md`.
 * @param pluginUrl Base URL of the receiving plugin.
 * @param tool The tool's MCP name.
 * @param input The tool input.
 * @param token Bearer token for the call: the user's token in this sketch, an installation token later.
 * @returns Whether the tool succeeded, and what it returned.
 * @throws When the receiver can't be reached or answers with a protocol error.
 */
export async function callPluginTool(
  pluginUrl: string,
  tool: string,
  input: unknown,
  token: string | undefined,
): Promise<PluginToolResult> {
  const res = await fetch(`${pluginUrl.replace(/\/$/, "")}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: input } }),
  });
  if (!res.ok) throw new Error(`${pluginUrl}/mcp answered ${res.status} ${res.statusText}`);

  const body = await res.text();
  const message = parseJsonRpc(body, res.headers.get("content-type") ?? "");
  if (message.error) throw new Error(`${tool}: ${message.error.message}`);

  const result = message.result ?? {};
  const text = (result.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  return { ok: !result.isError, value: result.structuredContent ?? text };
}

interface JsonRpcMessage {
  result?: {
    isError?: boolean;
    structuredContent?: unknown;
    content?: { type: string; text?: string }[];
  };
  error?: { message: string };
}

/** Reads the JSON-RPC response from a JSON body or from the last `data:` line of an SSE stream. */
function parseJsonRpc(body: string, contentType: string): JsonRpcMessage {
  if (!contentType.includes("text/event-stream")) return JSON.parse(body) as JsonRpcMessage;
  const data = body.split("\n").filter((line) => line.startsWith("data:")).at(-1);
  if (!data) throw new Error("Empty MCP response stream");
  return JSON.parse(data.slice("data:".length)) as JsonRpcMessage;
}
