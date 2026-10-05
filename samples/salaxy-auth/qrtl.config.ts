import { defineQrtlConfig } from "@quartal/plugin";

export default defineQrtlConfig({
  title: "Salaxy Agent",
  description: "Simple API that uses an Agent to execute tasks on Salaxy API.",
  style: {
    logo: "https://cdn.salaxy.com/img/brand/salaxy-signature-640.png",
    icons: [{ src: "https://cdn.salaxy.com/img/brand/icon-192.png", mimeType: "image/png", sizes: ["192x192"] }],
  },
  auth: {
    mode: "quartal-hub",
    // Salaxy IAM: users sign in with their Salaxy account (https://test-iam.salaxy.com/auth/realms/salaxy/account).
    issuer: "https://test-iam.salaxy.com/auth/realms/salaxy",
    // The `iam-api` scope adds the Quartal IAM API audience to the token, so the same token can
    // be exchanged for a Salaxy SSO token (see src/lib/salaxyContext.ts). It requires the realm
    // to allow the scope for this client — requesting it before that breaks login with
    // invalid_scope, so it is commented out until the realm is configured:
    // scope: "quartal-hub-test iam-api",
  },
  deploy: { org: "quartal", app: "salaxy-auth" },
});
