/** The contents of a specific resource or sub-resource. */
export interface ResourceContents {
  /** The URI of this resource. */
  uri: string;
  /** The MIME type of this resource, if known. */
  mimeType?: string;
  /** Reserved by the protocol for metadata. */
  _meta?: Record<string, unknown>;
}

/** Text contents of a resource. */
export interface TextResourceContents extends ResourceContents {
  /** The text of the item. This must only be set if the item can actually be represented as text (not binary data). */
  text: string;
}

/** Binary contents of a resource. */
export interface BlobResourceContents extends ResourceContents {
  /** A base64-encoded string representing the binary data of the item. */
  blob: string;
}
