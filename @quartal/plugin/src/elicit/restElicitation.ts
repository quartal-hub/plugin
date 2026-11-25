import type { ElicitationContext } from "../model/index.ts";

/**
 * Request header with which a REST caller declares that it can elicit: `form`, `url` or both
 * (comma-separated). Without it, `elicitForm` / `elicitUrl` resolve with their fallback.
 */
export const ELICITATION_HEADER = "Qrtl-Elicitation";
/**
 * Request header of a retried REST call: the answers, as base64url-encoded JSON of the
 * `inputResponses` map (`{ "<key>": { "action": "accept", "content": { … } } }`).
 */
export const INPUT_RESPONSES_HEADER = "Qrtl-Input-Responses";

/**
 * The elicitation state of a REST tool call from its headers, or `undefined` when the caller did
 * not opt in with `Qrtl-Elicitation`.
 * @param header Reads one request header.
 * @param schemas The tool's generated form schemas by key.
 * @throws When `Qrtl-Input-Responses` is not base64url-encoded JSON of an object.
 */
export function restElicitation(
  header: (name: string) => string | undefined,
  schemas: Record<string, Record<string, unknown>>,
): ElicitationContext | undefined {
  const modes = (header(ELICITATION_HEADER) ?? "").split(",").map((m) => m.trim().toLowerCase());
  const form = modes.includes("form");
  const url = modes.includes("url");
  if (!form && !url) return undefined;
  const encoded = header(INPUT_RESPONSES_HEADER);
  let responses: Record<string, unknown> = {};
  if (encoded) {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${INPUT_RESPONSES_HEADER} must encode a JSON object`);
    }
    responses = parsed as Record<string, unknown>;
  }
  return { form, url, responses, schemas };
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
