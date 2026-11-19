/**
 * The fields every event carries (CloudEvents style). Proposed for `@quartal/plugin-core`; see
 * `docs/events.md`.
 */
export interface QrtlEventEnvelope {
  /** Unique per event; the same on redelivery. Receivers deduplicate on it. */
  id: string;
  /** Reverse-DNS event type, e.g. `com.quartal.email.received`. */
  type: string;
  /** Who produced the event. */
  source: string;
  /** When it happened (ISO 8601). */
  time: string;
}
