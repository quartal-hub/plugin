import type {
  HubDrive,
  HubFileContent,
  HubFileEntry,
  HubFileGrepMatch,
  HubFileTransfer,
  HubFileVersion,
} from "../model/index.ts";
import type { HubApiClient } from "./HubApiClient.ts";
import type { HubCompanies } from "./HubCompanies.ts";

/** Picks the company whose files a call reads. */
export interface HubFilesOwnerOption {
  /**
   * The company whose files these are: its Quartal IAM id. Defaults to the user's selected
   * company (`HubCompanies.getSelected()`); without either the call throws.
   */
  owner?: string;
}

/**
 * Reading a company's files from Quartal Files: drives, folders, file contents, versions and
 * search. Paths start with the drive, e.g. `/data/raportit/2026.md`; `/` is the list of drives.
 *
 * Every call reads the files of one company, the `owner`. It defaults to the company the user has
 * selected (`hub.companies.setSelected()`), so a tool can work in "the current company" without
 * asking for it each time.
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
    return encoding === "base64" ? new TextDecoder().decode(Uint8Array.from(atob(content), (c) => c.charCodeAt(0))) : content;
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

  private async owner(options: HubFilesOwnerOption): Promise<string> {
    if (options.owner) return options.owner;
    const selected = await this.companies.getSelected();
    if (!selected) {
      throw new Error("No company selected: pass `owner`, or select one with `hub.companies.setSelected()`.");
    }
    return selected.companyId;
  }
}
