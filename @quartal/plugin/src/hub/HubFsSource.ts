import { FsError, type FsContent, type FsEntry, type FsErrorCode, type FsWriteResult, type QFsSource, type QFsWriteOptions } from "@quartal/core";

import { HubApiError } from "./HubApiError.ts";
import type { HubFiles } from "./HubFiles.ts";

/** The `FsErrorCode`s Quartal Files sends as its error `code`. */
const FS_CODES: readonly FsErrorCode[] = [
  "ENOENT", "EEXIST", "ENOTDIR", "EISDIR", "ENOTEMPTY", "EPERM", "ENOTSUP", "ECONFLICT", "EINVAL", "EQUOTA",
];

/** The code of a failure: the service's own code, else one from the HTTP status. */
function codeOf(error: HubApiError): FsErrorCode {
  if (FS_CODES.includes(error.code as FsErrorCode)) return error.code as FsErrorCode;
  switch (error.status) {
    case 400: return "EINVAL";
    case 403: return "EPERM";
    case 404: return "ENOENT";
    case 409: return "ECONFLICT";
    case 413: return "EQUOTA";
    default: return "EUNKNOWN";
  }
}

/**
 * The files of one company as a `QFsSource` of `@quartal/core` — the filesystem interface the file
 * components of `@quartal/ui-core` (tree view, editors) and `MemoryFs` share. Addresses are
 * `/{drive}/{path}`; `/` lists the drives. Every failure rejects with an `FsError`: components
 * branch on its `code`, never on HTTP statuses.
 *
 * The source has no `watch` (the change feed is read with `HubFiles.listChanges()`) and no `glob`
 * (`HubFiles.glob()` has no case-insensitive match); components fall back without them.
 * @experimental Part of the experimental Quartal Hub services; the API may change.
 */
export class HubFsSource implements QFsSource {
  /**
   * @param files The Quartal Files client of the current user.
   * @param owner The company: its Quartal IAM id. Defaults to the selected company, read on each call.
   */
  constructor(
    private readonly files: HubFiles,
    private readonly owner?: string,
  ) {}

  /** @inheritDoc */
  list(address: string, options?: { recursive?: boolean }): Promise<FsEntry[]> {
    return this.wrap(address, () => this.files.list(address, { owner: this.owner, recursive: options?.recursive }));
  }

  /** @inheritDoc */
  stat(address: string): Promise<FsEntry> {
    return this.wrap(address, () => this.files.getEntry(address, { owner: this.owner }));
  }

  /** @inheritDoc */
  read(address: string): Promise<FsContent> {
    return this.wrap(address, () => this.files.getContent(address, { owner: this.owner }));
  }

  /** @inheritDoc */
  write(address: string, content: string | Uint8Array, options?: QFsWriteOptions): Promise<FsWriteResult> {
    return this.wrap(address, () => this.files.write(address, content, { owner: this.owner, ifMatch: options?.ifMatch }));
  }

  /** @inheritDoc */
  mkdir(address: string, options?: { recursive?: boolean; ifNotExists?: boolean }): Promise<FsEntry> {
    return this.wrap(address, () => this.files.mkdir(address, { owner: this.owner, ...options }));
  }

  /** @inheritDoc */
  remove(address: string, options?: { recursive?: boolean }): Promise<void> {
    return this.wrap(address, () => this.files.delete(address, { owner: this.owner, recursive: options?.recursive }));
  }

  /** @inheritDoc */
  move(from: string, to: string, options?: { overwrite?: boolean }): Promise<FsEntry> {
    return this.wrap(from, () => this.files.move(from, to, { owner: this.owner, overwrite: options?.overwrite }));
  }

  /** @inheritDoc */
  copy(from: string, to: string, options?: { overwrite?: boolean; recursive?: boolean }): Promise<FsEntry> {
    return this.wrap(from, () => this.files.copy(from, to, { owner: this.owner, ...options }));
  }

  private async wrap<T>(address: string, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (e) {
      if (e instanceof FsError) throw e;
      if (e instanceof HubApiError) throw new FsError(codeOf(e), e.message, address);
      throw new FsError("EUNKNOWN", e instanceof Error ? e.message : String(e), address);
    }
  }
}
