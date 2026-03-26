/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly MODE: string; // 'development' | 'production' | 'test'
  readonly VITE_API_BASE?: string;
  readonly VITE_GRAPHQL_BASE?: string;
  readonly VITE_GRAPHQL_ENDPOINT?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
