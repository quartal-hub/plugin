/**
 * The catch-all Astro route the integration injects at `/[...qrtlPath]`, exported from
 * `@quartal/plugin/astro/route`.
 *
 * The plugin's server routes (`/plugin.json`, `/api/*`, `/mcp`, …) are answered by the Hono app
 * from the `onRequest` middleware, which runs before any route handler — so this handler is never
 * reached for them. It exists so those paths are *Astro routes* as far as the host platform is
 * concerned: adapters that translate the route table into platform routing (Vercel) send every
 * path with no Astro route to the server function with a forced `404` status, which would
 * overwrite the Hono app's status on every plugin route. With a server-rendered catch-all in the
 * table, unmatched paths reach the function as ordinary requests instead.
 *
 * Paths the middleware does not claim end here with an empty 404, which Astro turns into the
 * project's 404 page.
 */
export function ALL(): Response {
  return new Response(null, { status: 404 });
}
