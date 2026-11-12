import type {
  HubDrive,
  HubFileChangePage,
  HubFileContent,
  HubFileEntry,
  HubFileGrepMatch,
  HubFileItem,
  HubFileSnapshot,
  HubFileTransfer,
  HubFileVersion,
  HubFileWriteResult,
} from "../model/index.ts";
import { base64ToBytes, bytesToBase64 } from "./base64.ts";
import { HubApiError } from "./HubApiError.ts";
import type { HubApiClient } from "./HubApiClient.ts";
import type { HubCompanies } from "./HubCompanies.ts";

/** Picks the company whose files a call works on. */
export interface HubFilesOwnerOption {
  /**
   * The company whose files these are: its Quartal IAM id. Defaults to the user's selected
   * company (`HubCompanies.getSelected()`); without either the call throws.
   */
  owner?: string;
}

/** Options of {@link HubFiles.write}. */
export interface HubFileWriteOptions extends HubFilesOwnerOption {
  /**
   * Concurrency guard: the version the caller last read (`entry.version`); the write is refused
   * when the file has changed since. `null` means the file must not exist yet.
   */
  ifMatch?: string | null;
  /** The MIME type, when the extension does not say. */
  mimeType?: string;
  /** Application-defined type of the file, searchable with {@link HubFiles.search}. */
  type?: string;
  /** A message stored with the version, like a commit message. */
  message?: string;
  /** Create missing parent folders (the service's default is to create them). */
  mkdirp?: boolean;
}

/**
 * A company's files in Quartal Files: drives, folders, file contents, versions, search and the
 * change feed. Paths start with the drive, e.g. `/data/raportit/2026.md`; `/` is the list of drives.
 *
 * Every call works on the files of one company, the `owner`. It defaults to the company the user
 * has selected (`hub.companies.setSelected()`), so a tool can work in "the current company"
 * without asking for it each time.
 *
 * For code written against the `QFsSource` interface of `@quartal/core` (the filesystem the file
 * components of `@quartal/ui-core` work on), `hub.fsSource()` adapts these files to it.
 * @experimental Part of the experimental Quartal Hub services; the API may change.
 */
export class HubFiles {
  /**
   * @param files Client for Quartal Files, authenticated as the current user.
   * @param companies The user's companies, for the default `owner` (the selected company).
   */
  constructor(
    private readonly files: HubApiClient,
    private readonly companies: HubCompanies,
  ) {}

  // ---------------------------------------------------------------- drives

  /**
   * The company's drives.
   * @param options The company.
   * @returns The drives.
   */
  async listDrives(options: HubFilesOwnerOption = {}): Promise<HubDrive[]> {
    const res = await this.files.get<{ drives: HubDrive[] }>("/api/drives", { owner: await this.owner(options) });
    return res.drives;
  }

  /**
   * Creates a drive. An existing drive is returned as it is.
   * @param id Id of the drive: the first segment of the paths on it, e.g. `data`.
   * @param options The company, and the display name.
   * @returns The drive.
   */
  async createDrive(id: string, options: HubFilesOwnerOption & {
    /** Display name of the drive. */
    name?: string;
  } = {}): Promise<HubDrive> {
    return this.files.request<HubDrive>("POST", "/api/drives", {
      body: { owner: await this.owner(options), id, name: options.name },
    });
  }

  // ---------------------------------------------------------------- reading

  /**
   * The children of a folder, folders first; `/` lists the drives.
   * @param path The folder, e.g. `/data/raportit`.
   * @param options The company, and whether to list every descendant.
   * @returns The entries.
   * @example
   * ```ts
   * const hub = getExperimentalHubContext(ctx);
   * const reports = await hub.files.list("/data/raportit");
   * ```
   */
  async list(path: string, options: HubFilesOwnerOption & {
    /** Every descendant instead of the children (default false). */
    recursive?: boolean;
    /** At most this many entries. */
    limit?: number;
  } = {}): Promise<HubFileEntry[]> {
    const { recursive, limit } = options;
    const res = await this.files.get<{ entries: HubFileEntry[] }>("/api/files", {
      owner: await this.owner(options),
      path,
      recursive,
      limit,
    });
    return res.entries;
  }

  /**
   * One file or folder, without its content.
   * @param path The path, e.g. `/data/raportit/2026.md`.
   * @param options The company.
   * @returns The entry.
   */
  async getEntry(path: string, options: HubFilesOwnerOption = {}): Promise<HubFileEntry> {
    return this.files.get<HubFileEntry>("/api/files/entry", { owner: await this.owner(options), path });
  }

  /**
   * A file's content: text as such (`utf8`), anything else as base64. A file too large to travel
   * in a response is refused; fetch it from {@link HubFiles.getDownloadUrl} instead.
   * @param path The path, e.g. `/data/raportit/2026.md`.
   * @param options The company, and an earlier version to read instead of the current one.
   * @returns The file, the encoding and the content.
   */
  async getContent(path: string, options: HubFilesOwnerOption & {
    /** An earlier version (from {@link HubFiles.listVersions}) instead of the current one. */
    version?: string;
  } = {}): Promise<HubFileContent> {
    return this.files.get<HubFileContent>("/api/files/content", {
      owner: await this.owner(options),
      path,
      version: options.version,
    });
  }

  /**
   * A file's content as text, decoding base64 content as UTF-8.
   * @param path The path, e.g. `/data/raportit/2026.md`.
   * @param options The company, and an earlier version to read instead of the current one.
   * @returns The text.
   */
  async getText(path: string, options: HubFilesOwnerOption & { version?: string } = {}): Promise<string> {
    const { encoding, content } = await this.getContent(path, options);
    return encoding === "base64" ? new TextDecoder().decode(base64ToBytes(content)) : content;
  }

  /**
   * A short-lived URL the file's bytes can be fetched from directly: for a file too large for
   * {@link HubFiles.getContent}, or for a browser to download.
   * @param path The path.
   * @param options The company, the version, and how long the URL works.
   * @returns The URL with the method and headers to use.
   */
  async getDownloadUrl(path: string, options: HubFilesOwnerOption & {
    /** An earlier version instead of the current one. */
    version?: string;
    /** How long the URL works, in seconds (default 300, at most 900). */
    expiresInSeconds?: number;
  } = {}): Promise<HubFileTransfer> {
    return this.files.get<HubFileTransfer>("/api/files/download-url", {
      owner: await this.owner(options),
      path,
      version: options.version,
      expiresInSeconds: options.expiresInSeconds,
    });
  }

  /**
   * A file's history, newest first.
   * @param path The path.
   * @param options The company, and at most how many versions.
   * @returns The versions.
   */
  async listVersions(path: string, options: HubFilesOwnerOption & {
    /** At most this many versions. */
    limit?: number;
  } = {}): Promise<HubFileVersion[]> {
    const res = await this.files.get<{ versions: HubFileVersion[] }>("/api/files/versions", {
      owner: await this.owner(options),
      path,
      limit: options.limit,
    });
    return res.versions;
  }

  // ---------------------------------------------------------------- writing

  /**
   * Writes a file, creating missing folders. Identical content changes nothing (`unchanged`).
   * Text is stored as such; bytes are sent as base64. Content too large to travel in a request
   * is refused; send it with {@link HubFiles.upload} instead.
   * @param path The path, e.g. `/data/notes/today.md`.
   * @param content The text, or the bytes.
   * @param options The company, a concurrency guard, and what to store with the version.
   * @returns The file after the write.
   * @example
   * ```ts
   * const { entry } = await hub.files.getContent("/data/notes/today.md");
   * await hub.files.write("/data/notes/today.md", "# Updated", { ifMatch: entry.version });
   * ```
   */
  async write(path: string, content: string | Uint8Array, options: HubFileWriteOptions = {}): Promise<HubFileWriteResult> {
    const { ifMatch, mimeType, type, message, mkdirp } = options;
    const encoded = typeof content === "string"
      ? { content, encoding: "utf8" as const }
      : { content: bytesToBase64(content), encoding: "base64" as const };
    return this.files.request<HubFileWriteResult>("POST", "/api/files/write", {
      body: { owner: await this.owner(options), path, ...encoded, ifMatch, mimeType, type, message, mkdirp },
    });
  }

  /**
   * Creates a folder, with missing parents unless `recursive` is false. An existing folder is
   * returned as it is unless `ifNotExists` is false.
   * @param path The folder, e.g. `/data/notes/2026`.
   * @param options The company, and how to treat missing parents and an existing folder.
   * @returns The folder.
   */
  async mkdir(path: string, options: HubFilesOwnerOption & {
    /** Create missing parents (default true). */
    recursive?: boolean;
    /** Return an existing folder instead of failing (default true). */
    ifNotExists?: boolean;
  } = {}): Promise<HubFileEntry> {
    const { recursive, ifNotExists } = options;
    return this.files.request<HubFileEntry>("POST", "/api/files/mkdir", {
      body: { owner: await this.owner(options), path, recursive, ifNotExists },
    });
  }

  /**
   * Deletes a file, or a folder with `recursive`. The history is kept.
   * @param path The path.
   * @param options The company, and how to treat folders and a missing path.
   */
  async delete(path: string, options: HubFilesOwnerOption & {
    /** Delete a folder with its contents (default false). */
    recursive?: boolean;
    /** A missing path is not an error (default false). */
    force?: boolean;
  } = {}): Promise<void> {
    await this.files.request<unknown>("DELETE", "/api/files", {
      query: { owner: await this.owner(options), path, recursive: options.recursive, force: options.force },
    });
  }

  /**
   * Renames or moves a file or folder within one drive.
   * @param from The current path.
   * @param to The new path.
   * @param options The company, and whether to replace an existing destination.
   * @returns The entry at its new path.
   */
  async move(from: string, to: string, options: HubFilesOwnerOption & {
    /** Replace an existing destination (default false). */
    overwrite?: boolean;
  } = {}): Promise<HubFileEntry> {
    return this.files.request<HubFileEntry>("POST", "/api/files/move", {
      body: { owner: await this.owner(options), from, to, overwrite: options.overwrite },
    });
  }

  /**
   * Copies a file, or a folder with its contents unless `recursive` is false.
   * @param from The path to copy.
   * @param to The path of the copy.
   * @param options The company, and how to copy.
   * @returns The copy.
   */
  async copy(from: string, to: string, options: HubFilesOwnerOption & {
    /** Replace an existing destination (default false). */
    overwrite?: boolean;
    /** Copy a folder with its contents (default true). */
    recursive?: boolean;
  } = {}): Promise<HubFileEntry> {
    const { overwrite, recursive } = options;
    return this.files.request<HubFileEntry>("POST", "/api/files/copy", {
      body: { owner: await this.owner(options), from, to, overwrite, recursive },
    });
  }

  /**
   * Sets properties on a file or folder: merged into the existing ones, or replacing them.
   * Properties are searchable with {@link HubFiles.search}.
   * @param path The path.
   * @param props The properties.
   * @param options The company, how to combine, and a concurrency guard.
   * @returns The entry with its new properties.
   */
  async setProps(path: string, props: Record<string, unknown>, options: HubFilesOwnerOption & {
    /** `merge` into the existing properties (default) or `replace` them. */
    merge?: "merge" | "replace";
    /** Concurrency guard: the version the caller last read. */
    ifMatch?: string;
  } = {}): Promise<HubFileEntry> {
    const { merge, ifMatch } = options;
    return this.files.request<HubFileEntry>("POST", "/api/files/set-props", {
      body: { owner: await this.owner(options), path, props, merge, ifMatch },
    });
  }

  /**
   * Makes an earlier version the current one, as a new version.
   * @param path The path.
   * @param version The version to restore (from {@link HubFiles.listVersions}).
   * @param options The company.
   * @returns The file after the restore.
   */
  async restore(path: string, version: string, options: HubFilesOwnerOption = {}): Promise<HubFileWriteResult> {
    return this.files.request<HubFileWriteResult>("POST", "/api/files/restore", {
      body: { owner: await this.owner(options), path, version },
    });
  }

  // ---------------------------------------------------------------- large files

  /**
   * A short-lived URL to send a file's bytes to directly. Hash the content first (SHA-256,
   * lowercase hex), upload with exactly the method and headers returned, then call
   * {@link HubFiles.commitUpload} with the same hash and size. {@link HubFiles.upload} does all three.
   * @param path The path the file will have.
   * @param options The company, the content's hash and size, and how long the URL works.
   * @returns The URL with the method and headers to use.
   */
  async getUploadUrl(path: string, options: HubFilesOwnerOption & {
    /** SHA-256 of the content, lowercase hex. */
    hash: string;
    /** Size of the content in bytes. */
    size: number;
    /** The MIME type, when the extension does not say. */
    mimeType?: string;
    /** How long the URL works, in seconds (default 300, at most 900). */
    expiresInSeconds?: number;
  }): Promise<HubFileTransfer> {
    const { hash, size, mimeType, expiresInSeconds } = options;
    return this.files.get<HubFileTransfer>("/api/files/upload-url", {
      owner: await this.owner(options),
      path,
      hash,
      size,
      mimeType,
      expiresInSeconds,
    });
  }

  /**
   * Records an upload made to a {@link HubFiles.getUploadUrl} URL as the file's new content. The
   * stored bytes are checked against the hash and size first.
   * @param path The path.
   * @param options The company, the content's hash and size, and what to store with the version.
   * @returns The file after the write.
   */
  async commitUpload(path: string, options: Omit<HubFileWriteOptions, "mkdirp"> & {
    /** SHA-256 of the content, lowercase hex. */
    hash: string;
    /** Size of the content in bytes. */
    size: number;
  }): Promise<HubFileWriteResult> {
    const { hash, size, mimeType, ifMatch, type, message } = options;
    return this.files.request<HubFileWriteResult>("POST", "/api/files/commit-upload", {
      body: { owner: await this.owner(options), path, hash, size, mimeType, ifMatch, type, message },
    });
  }

  /**
   * Writes a file of any size: hashes the bytes, sends them to an upload URL and commits them.
   * @param path The path.
   * @param bytes The content.
   * @param options The company, a concurrency guard, and what to store with the version.
   * @returns The file after the write.
   */
  async upload(path: string, bytes: Uint8Array, options: Omit<HubFileWriteOptions, "mkdirp"> = {}): Promise<HubFileWriteResult> {
    const owner = await this.owner(options);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>));
    const hash = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
    const size = bytes.byteLength;
    const transfer = await this.getUploadUrl(path, { owner, hash, size, mimeType: options.mimeType });
    const res = await fetch(transfer.url, {
      method: transfer.method,
      headers: transfer.headers ?? undefined,
      body: bytes as Uint8Array<ArrayBuffer>,
    });
    if (!res.ok) {
      throw new HubApiError(res.status, transfer.method, transfer.url.split("?")[0], res.statusText || "upload failed");
    }
    return this.commitUpload(path, { ...options, owner, hash, size });
  }

  // ---------------------------------------------------------------- search

  /**
   * Files whose path matches a glob pattern, e.g. `**\/*.md`.
   * @param pattern The glob pattern.
   * @param options The company, and where to search.
   * @returns The matching entries.
   */
  async glob(pattern: string, options: HubFilesOwnerOption & {
    /** Search only this drive. */
    drive?: string;
    /** Match the pattern relative to this folder. */
    cwd?: string;
    /** At most this many entries. */
    limit?: number;
  } = {}): Promise<HubFileEntry[]> {
    const { drive, cwd, limit } = options;
    const res = await this.files.request<{ entries: HubFileEntry[] }>("POST", "/api/files/glob", {
      body: { owner: await this.owner(options), pattern, drive, cwd, limit },
    });
    return res.entries;
  }

  /**
   * Lines of text files that contain a string.
   * @param query The text to find.
   * @param options The company, where to search, and how.
   * @returns The matching lines with their files.
   */
  async grep(query: string, options: HubFilesOwnerOption & {
    /** Search only this drive. */
    drive?: string;
    /** Search only under this folder. */
    cwd?: string;
    /** Search only files whose path matches one of these glob patterns. */
    include?: string[];
    /** Ignore case (default false). */
    caseInsensitive?: boolean;
    /** At most this many matches. */
    maxMatches?: number;
  } = {}): Promise<HubFileGrepMatch[]> {
    const { drive, cwd, include, caseInsensitive, maxMatches } = options;
    const res = await this.files.request<{ matches: HubFileGrepMatch[] }>("POST", "/api/files/grep", {
      body: { owner: await this.owner(options), query, drive, cwd, include, caseInsensitive, maxMatches },
    });
    return res.matches;
  }

  /**
   * Entries by application-defined type, path prefix and properties, ordered by path.
   * @param options The company and the criteria.
   * @returns The matching entries, with the text of small text files when `inlineMax` is set.
   */
  async search(options: HubFilesOwnerOption & {
    /** Search only this drive. */
    drive?: string;
    /** Only files of these types (see {@link HubFileWriteOptions.type}). */
    types?: string[];
    /** Only entries whose path starts with this. */
    pathPrefix?: string;
    /** Only entries whose properties include these values. */
    props?: Record<string, unknown>;
    /** Include folders (default false). */
    includeFolders?: boolean;
    /** Include the text of text files up to this many bytes. */
    inlineMax?: number;
    /** At most this many entries. */
    limit?: number;
  } = {}): Promise<HubFileItem[]> {
    const { drive, types, pathPrefix, props, includeFolders, inlineMax, limit } = options;
    const res = await this.files.request<{ items: HubFileItem[] }>("POST", "/api/sync/search", {
      body: { owner: await this.owner(options), drive, types, pathPrefix, props, includeFolders, inlineMax, limit },
    });
    return res.items;
  }

  // ---------------------------------------------------------------- change feed

  /**
   * A whole drive and the change cursor it matches, read at one instant: the starting point for
   * keeping a copy in sync with {@link HubFiles.listChanges}.
   * @param options The company, the drive, and how much text to include.
   * @returns The snapshot.
   */
  async getSnapshot(options: HubFilesOwnerOption & {
    /** The drive (default `data`). */
    drive?: string;
    /** Include the text of text files up to this many bytes. */
    inlineMax?: number;
  } = {}): Promise<HubFileSnapshot> {
    return this.files.get<HubFileSnapshot>("/api/sync/snapshot", {
      owner: await this.owner(options),
      drive: options.drive,
      inlineMax: options.inlineMax,
    });
  }

  /**
   * Every committed change after a cursor, in commit order — including changes made by other
   * users and agents. An empty page means nothing has changed. A cursor older than the retained
   * history fails with status 410: start again from {@link HubFiles.getSnapshot}.
   * @param options The company, the cursor, and which changes.
   * @returns A page of changes and the cursor to continue from.
   */
  async listChanges(options: HubFilesOwnerOption & {
    /** The cursor of the last page or snapshot read (default 0: from the start). */
    since?: number;
    /** Only changes in this drive. */
    drive?: string;
    /** At most this many changes (default and maximum 1000). */
    limit?: number;
  } = {}): Promise<HubFileChangePage> {
    const { since, drive, limit } = options;
    return this.files.get<HubFileChangePage>("/api/sync/changes", {
      owner: await this.owner(options),
      since,
      drive,
      limit,
    });
  }

  private async owner(options: HubFilesOwnerOption): Promise<string> {
    if (options.owner) return options.owner;
    const selected = await this.companies.getSelected();
    if (!selected) {
      throw new Error("No company selected: pass `owner`, or select one with `hub.companies.setSelected()`.");
    }
    return selected.companyId;
  }
}
