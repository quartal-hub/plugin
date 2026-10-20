import { defineQrtlConfig } from "@quartal/plugin";

export default defineQrtlConfig({
  title: "Quartal IAM API",
  description: "The directory of persons, companies and teams behind Quartal and Salaxy sign-in: the caller's companies, firm administration, teams and mandates, the platform operator's view, Salaxy tokens, KYC and the caller's secrets. Signatures only: every tool throws not implemented.",
  style: {
    logo: "https://cdn.quartal.com/img/logo/quartal-logo-vertical.png",
    icons: [{ src: "https://cdn.quartal.com/img/logo/quartal-logo-q.png", mimeType: "image/png", sizes: ["128x128"] }],
  },
  auth: {
    mode: "quartal-hub",
    issuer: "https://test-iam.salaxy.com/auth/realms/salaxy",
    scope: "quartal-hub-test iam-api",
  },
  deploy: { org: "quartal", app: "iam-api" },
});
