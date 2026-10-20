/** A secret without its value. */
export interface SecretInfo {
  /** Unique per owner, e.g. `salaxy-sso-certificate`. */
  name: string;
  /** Free-form classifier: `password` | `api-key` | `certificate` | ... */
  kind: string;
  /** NON-secret descriptors (account id, thumbprint, expiry, ...). Never put the secret here. */
  metadata: { [key: string]: unknown };
  createdAt: string;
  updatedAt: string;
}
