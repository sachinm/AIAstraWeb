/**
 * Vite plugin: after the client build, prerender every page in PUBLIC_PAGES to static HTML so crawlers and link
 * previews get the page's markup and head tags without running JavaScript.
 *
 * It bundles `src/entry-server.tsx` with a Vite SSR build (so TSX, CSS imports and `import.meta.env` behave as in the
 * app), renders each public path with a `StaticRouter`, and writes the result over the built SPA shell. Private routes
 * are not in PUBLIC_PAGES and keep the SPA fallback. `/pricing` renders its loading shell: plans are fetched at runtime.
 *
 * Output per path: `dist/<path>/index.html`, and `dist/<path>.html` too. Amplify serves `/terms` from `terms.html`
 * when it exists, and otherwise redirects to `/terms/` (a second URL for the same page); other hosts ignore the copy.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build, type Plugin, type ResolvedConfig } from 'vite';
import { PRERENDERED_PRIVATE_PATHS, PUBLIC_PAGES, trimSiteUrl } from '../src/lib/seoConfig';
import { injectPage, prerenderFiles } from '../src/lib/prerenderHtml';

interface EntryServer {
  renderRoute: (pathname: string) => string;
  headTagsFor: (pathname: string, origin: string, hostname: string) => Parameters<typeof injectPage>[2];
}

export function prerenderPublicPages(env: Record<string, string>): Plugin {
  let config: ResolvedConfig;
  const siteUrl = trimSiteUrl(env.VITE_SITE_URL);
  return {
    name: 'prerender-public-pages',
    apply: 'build',
    configResolved(c) {
      config = c;
    },
    closeBundle: {
      // After spa-fallback-404 has copied the untouched shell to 404.html, which must stay an empty shell.
      order: 'post',
      sequential: true,
      async handler() {
        if (config.build.ssr) return; // the nested server build below loads this config too
        const outDir = resolve(config.root, config.build.outDir);
        const indexPath = resolve(outDir, 'index.html');
        if (!existsSync(indexPath)) return;
        const template = readFileSync(indexPath, 'utf8');

        const ssrDir = resolve(config.root, 'node_modules/.prerender');
        await build({
          configFile: config.configFile,
          mode: config.mode,
          logLevel: 'warn',
          build: { ssr: 'src/entry-server.tsx', outDir: ssrDir, emptyOutDir: true, copyPublicDir: false },
        });
        const entry = (await import(pathToFileURL(resolve(ssrDir, 'entry-server.js')).href)) as EntryServer;

        // A host that is indexable by hostIsIndexable; with no VITE_SITE_URL the canonical is a relative path.
        let hostname = 'prerender.invalid';
        let origin = '';
        if (siteUrl) {
          const u = new URL(siteUrl);
          hostname = u.hostname;
          origin = u.origin;
        } else if (String(env.VITE_SEO_INDEX ?? '1').trim() !== '0') {
          config.logger.warn('[prerender] VITE_SITE_URL is not set: canonical, og:url and og:image are relative paths.');
        }
        const paths = [...PUBLIC_PAGES.map((p) => p.path), ...PRERENDERED_PRIVATE_PATHS];
        for (const path of paths) {
          const html = injectPage(template, entry.renderRoute(path), entry.headTagsFor(path, origin, hostname));
          for (const file of prerenderFiles(path)) {
            const target = resolve(outDir, file);
            mkdirSync(dirname(target), { recursive: true });
            writeFileSync(target, html);
          }
        }
        config.logger.info(`[prerender] ${paths.length} pages written to ${config.build.outDir}`);
      },
    },
  };
}
