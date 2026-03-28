/// <reference types="vitest" />
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * BrowserRouter paths (e.g. /dashboard) must map to index.html on full reload.
 * Vite's built-in htmlFallback only runs for certain Accept headers (text/html or any);
 * some clients send stricter Accept and get a real 404. This rewrite ignores Accept.
 * Plugin configureServer runs before Vite's static chain, so this runs first.
 */
function spaHistoryFallback(): Plugin {
  const shouldRewrite = (pathname: string) => {
    if (pathname === '/' || pathname === '') return false;
    if (pathname.includes('.')) return false;
    if (
      pathname.startsWith('/@') ||
      pathname.startsWith('/__') ||
      pathname.startsWith('/src/') ||
      pathname.startsWith('/node_modules/')
    ) {
      return false;
    }
    return true;
  };

  const middleware = (
    req: { url?: string; method?: string },
    _res: unknown,
    next: () => void
  ) => {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') return next();
    const raw = req.url ?? '/';
    const q = raw.includes('?') ? `?${raw.split('?')[1]}` : '';
    const pathname = raw.split('?')[0] ?? '/';
    if (!shouldRewrite(pathname)) return next();
    req.url = `/index.html${q}`;
    next();
  };

  return {
    name: 'spa-history-fallback',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  // Ensure deep links like /dashboard serve index.html on full reload (SPA fallback).
  appType: 'spa',
  plugins: [spaHistoryFallback(), react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
