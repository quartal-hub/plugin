import { serve } from "@hono/node-server";

/** A served test app: close it in `afterAll`. */
export interface TestServer {
  close(): void;
}

/**
 * Serves an app over real HTTP on a random local port, for tests that drive it with a real client
 * (the MCP SDK, `fetch` across origins).
 * @param app The app to serve: anything with a `fetch` handler, e.g. a Hono app.
 * @returns The server, and its base URL (`http://127.0.0.1:<port>`, no trailing slash).
 * @example
 * ```ts
 * let server: TestServer;
 * let baseUrl = "";
 * beforeAll(async () => ({ server, baseUrl } = await serveForTest(app)));
 * afterAll(() => server?.close());
 * ```
 */
export function serveForTest(
  app: { fetch: (request: Request) => Response | Promise<Response> },
): Promise<{ server: TestServer; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, (info: { port: number }) => {
      resolve({ server, baseUrl: `http://127.0.0.1:${info.port}` });
    }) as unknown as TestServer;
  });
}
