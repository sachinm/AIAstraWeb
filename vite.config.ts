/// <reference types="vitest" />
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { buildRobotsTxt, buildSitemapXml, robotsContent, trimSiteUrl } from './src/lib/seoConfig';

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

/**
 * SEO files for the build: robots.txt and sitemap.xml from the page list in src/lib/seoConfig.ts, and the default
 * robots meta in index.html. `VITE_SEO_INDEX=0` (staging) makes the whole build noindex; `VITE_SITE_URL` gives the
 * absolute URLs the sitemap needs. The sitemap is skipped when the URL is unset, rather than emitted with a wrong host.
 */
function seoFiles(env: Record<string, string>): Plugin {
  const siteUrl = trimSiteUrl(env.VITE_SITE_URL);
  const indexable = String(env.VITE_SEO_INDEX ?? '1').trim() !== '0';
  return {
    name: 'seo-files',
    transformIndexHtml(html) {
      const robots = `<meta name="robots" content="${robotsContent(indexable)}" data-seo />`;
      const canonical = indexable && siteUrl ? `\n    <link rel="canonical" href="${siteUrl}/" data-seo />` : '';
      return html.replace('<!--seo-robots-->', `${robots}${canonical}`);
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobotsTxt(siteUrl, indexable) });
      const sitemap = indexable ? buildSitemapXml(siteUrl, new Date().toISOString().slice(0, 10)) : null;
      if (sitemap) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), spaFallback404(), seoFiles(loadEnv(mode, process.cwd(), 'VITE_'))],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
}));
