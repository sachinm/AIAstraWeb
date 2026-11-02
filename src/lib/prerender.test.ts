// @vitest-environment node
/**
 * Builds the app twice (production with a site URL, then staging) and checks the prerendered public pages: a file for
 * every PUBLIC_PAGES path, none for the private prefixes, and head tags that match what `headTagsFor` writes at runtime.
 * Slow (two full builds), so it has its own timeout.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_OG_IMAGE, NOINDEX_PREFIXES, PRERENDERED_PRIVATE_PATHS, PUBLIC_PAGES, robotsContent } from './seoConfig';
import { injectPage, prerenderFiles, renderHeadTags } from './prerenderHtml';

const SITE = 'https://www.aiastra.example';
const root = resolve(__dirname, '../..');
const vite = join(root, 'node_modules/vite/bin/vite.js');

function build(mode: string, outDir: string, env: Record<string, string>): void {
  execFileSync(process.execPath, [vite, 'build', '--mode', mode, '--outDir', outDir, '--emptyOutDir'], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
}

const read = (dir: string, file: string) => readFileSync(join(dir, file), 'utf8');
const metaContent = (html: string, attr: string, name: string) =>
  new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`).exec(html)?.[1];
const urlFor = (path: string) => (path === '/' ? `${SITE}/` : `${SITE}${path}`);

describe('prerendered public pages', () => {
  let tmp = '';
  let prod = '';
  let staging = '';

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'aiastra-prerender-'));
    prod = join(tmp, 'prod');
    staging = join(tmp, 'staging');
    build('production', prod, { VITE_SITE_URL: SITE, VITE_SEO_INDEX: '1' });
    // the noindex path, set here because .env.staging's value follows what the domain serves
    build('staging', staging, { VITE_SITE_URL: '', VITE_SEO_INDEX: '0' });
  }, 280_000);

  afterAll(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it('writes a file for every public path, with real markup, its own head tags and the runtime robots value', () => {
    for (const page of PUBLIC_PAGES) {
      for (const file of prerenderFiles(page.path)) {
        const html = read(prod, file);
        expect(html, file).toContain(`<title>${page.title.replace(/&/g, '&amp;')}</title>`);
        expect(metaContent(html, 'name', 'robots'), file).toBe(robotsContent(true));
        expect(html.match(/<meta name="robots"/g), file).toHaveLength(1);
        expect(metaContent(html, 'name', 'description'), file).toBe(page.description);
        expect(metaContent(html, 'property', 'og:url'), file).toBe(urlFor(page.path));
        expect(metaContent(html, 'property', 'og:image'), file).toBe(`${SITE}${DEFAULT_OG_IMAGE}`);
        expect(html, file).toContain(`<link rel="canonical" href="${urlFor(page.path)}" data-seo />`);
        expect(html, file).toContain('type="application/ld+json"');
        expect(html, file).toMatch(/<div id="root"><div[^>]*>[\s\S]*<h1/);
        expect(html, file).toMatch(/<script type="module"[^>]*src="\/assets\//);
      }
    }
  });

  it('writes nothing for the signed-in app, and 404.html stays the empty SPA shell', () => {
    // sign-in and sign-up are the exception, prerendered for speed and still noindex (tested below)
    for (const prefix of NOINDEX_PREFIXES.filter((x) => !PRERENDERED_PRIVATE_PATHS.includes(x))) {
      expect(existsSync(join(prod, prefix.slice(1))), prefix).toBe(false);
      expect(existsSync(join(prod, `${prefix.slice(1)}.html`)), prefix).toBe(false);
    }
    const shell = read(prod, '404.html');
    expect(shell).toContain('<div id="root"></div>');
    expect(shell).toContain(`<meta name="robots" content="${robotsContent(true)}" data-seo />`);
  });

  it('with VITE_SEO_INDEX=0, every page is noindex and robots.txt disallows everything', () => {
    for (const page of PUBLIC_PAGES) {
      for (const file of prerenderFiles(page.path)) {
        const html = read(staging, file);
        expect(metaContent(html, 'name', 'robots'), file).toBe(robotsContent(false));
        expect(html, file).not.toContain('rel="canonical"');
        expect(html, file).not.toContain('application/ld+json');
      }
    }
    expect(read(staging, 'robots.txt')).toContain('Disallow: /\n');
    expect(existsSync(join(staging, 'sitemap.xml'))).toBe(false);
  });

  it('prerenders sign-in and sign-up, kept out of search, with the shared sky', () => {
    for (const [file, title] of [['signin/index.html', 'Sign in'], ['signup/index.html', 'Sign up']]) {
      const html = read(prod, file);
      expect(metaContent(html, 'name', 'robots'), file).toBe(robotsContent(false));
      expect(html, file).toContain(`<title>${title}`);
      expect(html, file).toContain('data-test-id="cosmic-sky"');
      expect(html, file).not.toContain('Discover Your Cosmic');
    }
    expect(read(prod, 'sitemap.xml')).not.toContain('signin');
  });

  it('is rewritten ahead of the SPA catch-all on Render and Netlify-style hosts', () => {
    const render = readFileSync(join(root, 'render.yaml'), 'utf8').split(/\r?\n/).join('\n');
    const redirects = readFileSync(join(root, 'public/_redirects'), 'utf8');
    for (const page of PUBLIC_PAGES.filter((p) => p.path !== '/')) {
      expect(render).toContain(`source: ${page.path}\n        destination: ${page.path}/index.html`);
      expect(redirects).toContain(`${page.path} `);
    }
  });
});

describe('injectPage', () => {
  const shell =
    '<head>\n    <title>x</title>\n    <meta name="robots" content="a" data-seo />\n    <link rel="canonical" href="/" data-seo />\n    <meta name="theme-color" content="#111" />\n  </head><body><div id="root"></div></body>';
  it('replaces the title and every data-seo tag, and fills #root', () => {
    const html = injectPage(shell, '<p>hi</p>', [
      { tag: 'title', attrs: {}, text: 'A & B' },
      { tag: 'meta', attrs: { name: 'robots', content: 'noindex' } },
    ]);
    expect(html).toContain('<title>A &amp; B</title>');
    expect(html.match(/name="robots"/g)).toHaveLength(1);
    expect(html).not.toContain('rel="canonical"');
    expect(html).toContain('<meta name="theme-color" content="#111" />');
    expect(html).toContain('<div id="root"><p>hi</p></div>');
  });
  it('escapes attribute values and script text', () => {
    const out = renderHeadTags([
      { tag: 'meta', attrs: { name: 'description', content: 'say "hi" <b>' } },
      { tag: 'script', attrs: { type: 'application/ld+json' }, text: '{"a":"</script>"}' },
    ]);
    expect(out).toContain('content="say &quot;hi&quot; &lt;b&gt;"');
    expect(out).not.toContain('</script>"');
    expect(JSON.parse(/>(\{.*\})<\/script>/.exec(out)![1])).toEqual({ a: '</script>' });
  });
  it('refuses a shell without an empty root', () => {
    expect(() => injectPage('<title>x</title><div id="root">full</div>', '', [])).toThrow(/root/);
  });
  it('maps paths to files', () => {
    expect(prerenderFiles('/')).toEqual(['index.html']);
    expect(prerenderFiles('/terms')).toEqual(['terms/index.html', 'terms.html']);
  });
});
