/// <reference types="vite/client" />

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

declare interface ImportMetaEnv {
  readonly MODE: string; // 'development' | 'production' | 'test'
  readonly VITE_API_BASE?: string;
  readonly VITE_GRAPHQL_BASE?: string;
  readonly VITE_GRAPHQL_ENDPOINT?: string;
  /** GraphQL `ask` client timeout (ms). Default 900000 (15m). Min 60000 if set, or 0 = no browser timeout. */
  readonly VITE_GRAPHQL_ASK_TIMEOUT_MS?: string;
  /** Omit or empty = SSE streaming (default). Set 0/false/off for GraphQL `ask` only. */
  readonly VITE_CHAT_STREAM?: string;
  /** Cloudflare Turnstile site key (public). Pair with server TURNSTILE_SECRET_KEY. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** Absolute public site URL (no trailing slash) for canonical links, Open Graph and the sitemap. */
  readonly VITE_SITE_URL?: string;
  /** Set to 0 on builds that must never be indexed (staging, previews). Default indexable. */
  readonly VITE_SEO_INDEX?: string;
  readonly VITE_SKY_HOLD_SECONDS?: string;
  readonly VITE_LEGAL_ENTITY?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
