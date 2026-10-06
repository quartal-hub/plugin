import type { QuartalPluginContext } from "@quartal/plugin-core";

/**
 * Provides information about the current session and token.
 */
export class info {

  /**
   * Gets the entire context information.
   * @param _input No parameters needed at the moment.
   * @param ctx Authenticated request context (token is omitted from the response).
   * @returns The context info.
   */
  getSessionInfo(_input: any, ctx: QuartalPluginContext): QuartalPluginContext {
    const { token: _token, ...others } = ctx;
    return others;
  }

  /**
   * Parses the bearer token (JWT) and returns its decoded header and payload for debugging.
   * The signature is not verified or returned.
   * @param _input No input needed at the moment.
   * @param ctx Authenticated request context.
   * @returns The decoded token header and payload, or an error if the token is missing or not a JWT.
   */
  getTokenInfo(_input: null, ctx: QuartalPluginContext): TokenInfo {
    if (!ctx.token) {
      return { error: "No token" };
    }
    return decodeJwt(ctx.token);
  }

}

/** Decodes the header and payload of a JWT without verifying the signature. */
function decodeJwt(token: string): TokenInfo {
  const parts = token.split(".");
  if (parts.length < 2) {
    return { error: "Token is not a JWT (opaque token).", token };
  }
  try {
    const decode = (part: string) =>
      JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
    return { header: decode(parts[0]), payload: decode(parts[1]), token };
  } catch (e) {
    return { error: `Failed to parse token: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export interface TokenInfo {
  /** The decoded JWT header. */
  header?: Record<string, unknown>;
  /** The decoded JWT payload (claims). */
  payload?: Record<string, unknown>;
  /** Set when the token is missing or cannot be parsed as a JWT. */
  error?: string;
  /** The original token string (for debugging purposes). */
  token?: string;
}
