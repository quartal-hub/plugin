import type { AjaxFetch } from "@salaxy/core";
import type { QuartalPluginContext } from "@quartal/plugin-core";

/**
 * The Salaxy session/API context the tools need — an authenticated Salaxy `AjaxFetch` client.
 * (Previously supplied by the removed `getSalaxyApp`; now derived from the Quartal IAM context.)
 */
export interface SalaxyContext {
  /** Returns an authenticated Salaxy ajax client for the current user. */
  getAjax(): AjaxFetch;
}

/**
 * Maps the Quartal IAM context ({@link QuartalPluginContext}) to a {@link SalaxyContext}.
 *
 * STUB — to be implemented using the Salaxy libraries (exchange the Quartal token/identity for a
 * Salaxy session and build an authenticated `AjaxFetch`). Throws until implemented.
 * @param ctx The verified Quartal IAM context for the current request.
 */
export async function quartalContextToSalaxyContext(ctx: QuartalPluginContext): Promise<SalaxyContext> {
  throw new Error(
    `quartalContextToSalaxyContext is not implemented yet (uid=${ctx.uid ?? "anonymous"}). `
      + `Implement the Quartal IAM → Salaxy session mapping using the Salaxy libraries.`,
  );
}
