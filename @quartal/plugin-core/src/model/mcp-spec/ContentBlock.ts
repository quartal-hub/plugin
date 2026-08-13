import type { AudioContent } from "./AudioContent.ts";
import type { EmbeddedResource } from "./EmbeddedResource.ts";
import type { ImageContent } from "./ImageContent.ts";
import type { ResourceLink } from "./ResourceLink.ts";
import type { TextContent } from "./TextContent.ts";

/** A content block that can be included in prompt and tool call results. */
export type ContentBlock =
  | TextContent
  | ImageContent
  | AudioContent
  | ResourceLink
  | EmbeddedResource;
