import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const STATIC_MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

/** Returns a MIME type for a static file path, or `application/octet-stream`. */
export function guessStaticMime(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  return STATIC_MIME[path.slice(dot).toLowerCase()] ?? "application/octet-stream";
}

/** Resolves `relativePath` under `root`, or returns null if it escapes the root. */
export function resolveUnderRoot(root: string, relativePath: string): string | null {
  const rel = relativePath.replaceAll("\\", "/");
  if (!rel || rel.includes("..") || rel.startsWith("/")) return null;
  const target = resolve(root, rel);
  const rootResolved = resolve(root);
  const norm = (p: string) => p.replaceAll("\\", "/").toLowerCase();
  const t = norm(target);
  const r = norm(rootResolved);
  if (t === r || t.startsWith(r + "/")) return target;
  return null;
}

/** Resolves `relativePath` under a root URL, or returns null if it escapes the root. */
export function resolveUnderRootUrl(root: URL, relativePath: string): URL | null {
  const rel = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!rel || rel.split("/").includes("..")) return null;
  const rootHref = root.href.endsWith("/") ? root.href : `${root.href}/`;
  const target = new URL(rel, rootHref);
  if (target.href.startsWith(rootHref)) return target;
  return null;
}

/** Reads static file bytes from a local `file:` URL or remote `http(s):` URL. */
export async function readStaticBytes(url: URL): Promise<Uint8Array | undefined> {
  try {
    if (url.protocol === "file:") {
      return new Uint8Array(await readFile(url));
    }
    if (url.protocol === "http:" || url.protocol === "https:") {
      const res = await fetch(url);
      if (!res.ok) return undefined;
      return new Uint8Array(await res.arrayBuffer());
    }
    return undefined;
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return undefined;
    throw e;
  }
}

/** Reads static file text from a local `file:` URL or remote `http(s):` URL. */
export async function readStaticText(url: URL): Promise<string | undefined> {
  const bytes = await readStaticBytes(url);
  if (bytes === undefined) return undefined;
  return new TextDecoder().decode(bytes);
}
