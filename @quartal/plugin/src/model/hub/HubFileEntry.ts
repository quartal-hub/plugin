import type { HubFileAuthor } from "./HubFileAuthor.ts";

/**
 * A file or folder in a company's files.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubFileEntry {
  /** Full URI of the entry, including the owner and the drive. */
  uri: string;
  /** The company whose file this is: its Quartal IAM id. */
  owner: string;
  /** Id of the drive the entry is on. */
  drive: string;
  /** Path of the entry, e.g. `/data/raportit/2026.md`. */
  path: string;
  /** Path of the parent folder. */
  parent: string;
  /** File or folder name. */
  name: string;
  /** Stable id of the entry. */
  id?: string;
  /** The entry is a folder. */
  isFolder: boolean;
  /** The entry cannot be changed. */
  isReadOnly: boolean;
  /** The entry is a link to another entry. */
  isLink: boolean;
  /** For a link: the path it points to. */
  linkTarget?: string;
  /** File extension. */
  ext?: string;
  /** MIME type of the content. */
  mimeType?: string;
  /** Content type, including e.g. the charset. */
  contentType?: string;
  /** Size of the content in bytes. */
  size?: number;
  /** SHA-256 of the content, lowercase hex. */
  hash?: string;
  /** Id of the current version. */
  version?: string;
  /** Who made the current version. */
  author?: HubFileAuthor;
  /** When the entry was created (ISO 8601). */
  createdAt?: string;
  /** When the entry was last changed (ISO 8601). */
  updatedAt?: string;
  /** Free-form properties set on the entry. */
  props?: unknown;
  /** Application-defined type of the file. */
  type?: string;
}
