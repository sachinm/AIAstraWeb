/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly VITE_GRAPHQL_BASE?: string;
  readonly VITE_GRAPHQL_ENDPOINT?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
