/**
 * The formats defined in the JSON schema specification (e.g. @format tags in docs).
 */
export interface TypeTesterJsonSchemaFormats {
  /**
   * A date string (ISO 8601, e.g. 2026-03-10).
   * @format date
   */
  date?: string;

  /**
   * A date-time string (ISO 8601, e.g. 2026-03-10T12:00:00.000Z).
   * @format date-time
   */
  dateTime?: string;

  /**
   * A time string (ISO 8601, e.g. 12:00:00.000).
   * @format time
   */
  time?: string;

  /**
   * A duration string (ISO 8601, e.g. P1Y2M3DT4H5M6S).
   * @format duration
   */
  duration?: string;

  /**
   * An email address, e.g. "user@example.com".
   * @format email
   */
  email?: string;

  /**
   * A complete URI (RFC 3986), e.g. "https://example.com/api/v1/users".
   * @format uri
   */
  uri?: string;

  /**
   * A URI or a relative reference, e.g. "/api/v1/users".
   * @format uri-reference
   */
  uriReference?: string;

  /**
   * A Universally Unique Identifier (e.g., 550e8400-e29b-41d4-a716-446655440000).
   * @format uuid
   */
  uuid?: string;
}
