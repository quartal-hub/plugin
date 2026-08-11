import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import qrtlPlugin from "@quartal/plugin/astro";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  // Quartal IAM (Keycloak/OIDC JWT bearer). Set OAUTH_ISSUER (+ related) in the environment.
  integrations: [qrtlPlugin({ auth: "quartal-iam" })],
});
