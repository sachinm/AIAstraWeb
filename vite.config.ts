/// <reference types="vitest" />
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Some static hosts serve 404.html for unknown paths — duplicate index.html for SPA deep links. */
function spaFallback404() {
  return {
    name: 'spa-fallback-404',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      const index = resolve(distDir, 'index.html');
      const notFound = resolve(distDir, '404.html');
      if (existsSync(index)) {
        copyFileSync(index, notFound);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), spaFallback404()],
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
