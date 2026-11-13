/**
 * Who made a change to a file: a person, an agent acting for a person, or the system.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubFileAuthor {
  /** Stable subject id: an IAM user id (`sub`), an agent id, or `system`. */
  id: string;
  /** What kind of actor made the change. */
  kind: "human" | "agent" | "system";
  /** Display name at the time of the change. */
  name?: string;
  /** Model or tool identifier when `kind` is `agent`. */
  agent?: string;
  /** The person an agent acted on behalf of. */
  onBehalfOf?: string;
}
