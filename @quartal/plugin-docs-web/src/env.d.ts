/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HUB_API_URL: string;
  readonly VITE_HUB_API_PROXY: string;
  readonly VITE_DEV_PORT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "swagger-ui-dist/swagger-ui-es-bundle.js" {
  interface SwaggerUiConfig {
    url?: string;
    domNode?: HTMLElement;
    deepLinking?: boolean;
    showExtensions?: boolean;
    showCommonExtensions?: boolean;
    tryItOutEnabled?: boolean;
    requestSnippetsEnabled?: boolean;
    persistAuthorization?: boolean;
  }

  export default function SwaggerUIBundle(config: SwaggerUiConfig): unknown;
}

declare module "redoc/bundles/redoc.standalone.js?url" {
  const url: string;
  export default url;
}
