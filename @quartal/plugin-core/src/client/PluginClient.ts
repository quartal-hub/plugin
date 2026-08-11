import type { CodeType, McpServerInfo, PluginInfo, SkillsCatalogResponse } from "../model/index.ts";

/** Options for {@link PluginClient}. */
export interface PluginClientOptions {
  /** Base URL of the Quartal plugin deployment (no trailing slash). */
  baseUrl?: string;
  /** Custom fetch implementation (defaults to global `fetch`). */
  fetch?: typeof fetch;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

function resolveUrl(baseUrl: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return baseUrl ? `${baseUrl}${p}` : p;
}

/** HTTP client for fetching metadata exposed by a Quartal Plugin. */
export class PluginClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: PluginClientOptions = {}) {
    this.#baseUrl = normalizeBaseUrl(options.baseUrl ?? "");
    // Bind global fetch — calling an unbound `fetch` reference throws in browsers.
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
  }

  /** Resolves a plugin-relative path against {@link PluginClientOptions.baseUrl}.
   * @param path Plugin-relative path (with or without leading slash).
   */
  url(path: string): string {
    return resolveUrl(this.#baseUrl, path);
  }

  async #fetchJson<T>(path: string): Promise<T> {
    const res = await this.#fetch(this.url(path));
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  async #fetchText(path: string): Promise<string> {
    const res = await this.#fetch(this.url(path));
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return await res.text();
  }

  /** Fetches `GET /plugin.json` (unified plugin overview). */
  getPlugin(): Promise<PluginInfo> {
    return this.#fetchJson<PluginInfo>("/plugin.json");
  }

  /** Fetches `GET /readme.md`. */
  getReadme(): Promise<string> {
    return this.#fetchText("/readme.md");
  }

  /** Fetches `GET /mcp-server.json`. */
  getMcpServer(): Promise<McpServerInfo> {
    return this.#fetchJson<McpServerInfo>("/mcp-server.json");
  }

  /** Fetches `GET /skills/catalog.json`. */
  getSkillsCatalog(): Promise<SkillsCatalogResponse> {
    return this.#fetchJson<SkillsCatalogResponse>("/skills/catalog.json");
  }

  /** Fetches `GET /types.json`. */
  getTypes(): Promise<CodeType[]> {
    return this.#fetchJson<CodeType[]>("/types.json");
  }

  /** Fetches `GET /open-api.json`. */
  getOpenApi(): Promise<Record<string, unknown>> {
    return this.#fetchJson<Record<string, unknown>>("/open-api.json");
  }

  /** Fetches a skill file by absolute URL or plugin-relative path.
   * @param url Absolute URL or plugin-relative path to the skill file.
   */
  fetchSkillFile(url: string): Promise<string> {
    const path = url.startsWith("http") ? url : this.url(url);
    return this.#fetch(path).then((res) => {
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return res.text();
    });
  }
}

/** Creates a {@link PluginClient} with optional configuration.
 * @param options Client configuration.
 */
export function createPluginClient(options?: PluginClientOptions): PluginClient {
  return new PluginClient(options);
}
