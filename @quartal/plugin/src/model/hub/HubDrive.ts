/**
 * A drive: a top-level folder of a company's files.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubDrive {
  /** Id of the drive: the first segment of the paths on it. */
  id: string;
  /** Display name of the drive. */
  name: string;
  /** Free-form properties set on the drive. */
  props?: unknown;
  /** The drive cannot be changed. */
  isReadOnly: boolean;
  /** When the drive was created (ISO 8601). */
  createdAt: string;
}
