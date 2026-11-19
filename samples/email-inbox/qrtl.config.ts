import { defineQrtlConfig } from "@quartal/plugin";

export default defineQrtlConfig({
  title: "Email Inbox",
  description: "Sketch of an ingress plugin: receives email for a company and delivers it to other plugins as tool calls.",
  style: {
    logo: "https://cdn.quartal.com/img/logo/quartal-logo-vertical.png",
    icons: [{ src: "https://cdn.quartal.com/img/logo/quartal-logo-q.png", mimeType: "image/png", sizes: ["128x128"] }],
  },
  auth: "quartal-hub",
});
