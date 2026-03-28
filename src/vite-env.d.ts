/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly MODE: string; // 'development' | 'production' | 'test'
  readonly VITE_API_BASE?: string;
  readonly VITE_GRAPHQL_BASE?: string;
  readonly VITE_GRAPHQL_ENDPOINT?: string;
  /** Client fetch timeout (ms) for GraphQL `ask` (LLM). Default 180000 if unset. Min 60000 if set. */
  readonly VITE_GRAPHQL_ASK_TIMEOUT_MS?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
