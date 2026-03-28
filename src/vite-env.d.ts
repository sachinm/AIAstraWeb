/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly MODE: string; // 'development' | 'production' | 'test'
  readonly VITE_API_BASE?: string;
  readonly VITE_GRAPHQL_BASE?: string;
  readonly VITE_GRAPHQL_ENDPOINT?: string;
  /** GraphQL `ask` client timeout (ms). Default 900000 (15m). Min 60000 if set, or 0 = no browser timeout. */
  readonly VITE_GRAPHQL_ASK_TIMEOUT_MS?: string;
  /** Omit or empty = SSE streaming (default). Set 0/false/off for GraphQL `ask` only. */
  readonly VITE_CHAT_STREAM?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
