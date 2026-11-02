import { describe, expect, it } from 'vitest';
import { applySeo, headTagsFor } from './seo';
import {
  NOINDEX_PREFIXES,
  PUBLIC_PAGES,
  buildRobotsTxt,
  buildSitemapXml,
  hostIsIndexable,
  isNoindexPath,
  jsonLdFor,
  pageSeoFor,
} from './seoConfig';
import { LANDING_FAQS } from './landingFaqs';

const SITE = 'https://www.aiastra.example';
const ORIGIN = SITE;
const HOST = 'www.aiastra.example';

describe('public pages', () => {
  it('each has its own title, a description under 160 chars and is indexable', () => {
    const titles = new Set(PUBLIC_PAGES.map((p) => p.title));
    expect(titles.size).toBe(PUBLIC_PAGES.length);
    for (const p of PUBLIC_PAGES) {
      expect(p.index).toBe(true);
      expect(p.title.length).toBeLessThanOrEqual(70);
      expect(p.description.length).toBeGreaterThan(50);
      expect(p.description.length).toBeLessThanOrEqual(160);
    }
    expect(PUBLIC_PAGES.map((p) => p.path)).toEqual(['/', '/pricing', '/terms', '/privacy', '/refunds']);
  });
  it('resolves trailing slashes, query strings and hashes to the page', () => {
    expect(pageSeoFor('/pricing/').path).toBe('/pricing');
    expect(pageSeoFor('/terms?x=1#top').path).toBe('/terms');
    expect(pageSeoFor('/').index).toBe(true);
  });
});

describe('private pages', () => {
  it('sign-in, sign-up, dashboard and profile are never indexed, nor anything under them', () => {
    for (const p of ['/signin', '/signup', '/signup/details', '/dashboard', '/dashboard/chat', '/dashboard/charts', '/profile', '/profile/x']) {
      expect(isNoindexPath(p), p).toBe(true);
      expect(pageSeoFor(p).index, p).toBe(false);
    }
    expect(NOINDEX_PREFIXES).toEqual(['/signin', '/signup', '/dashboard', '/profile']);
  });
  it('unknown paths are not indexed either', () => {
    expect(pageSeoFor('/nothing-here').index).toBe(false);
  });
  it('private pages still get a readable tab title', () => {
    expect(pageSeoFor('/signin').title).toMatch(/Sign in/);
    expect(pageSeoFor('/dashboard/chat').title).toMatch(/Ask about your chart/);
  });
});

describe('hosts', () => {
  it('local and Amplify preview hosts are never indexable', () => {
    for (const h of ['localhost', '127.0.0.1', 'main.d20sdo476h9w6c.amplifyapp.com', 'app.test', '']) expect(hostIsIndexable(h), h).toBe(false);
    expect(hostIsIndexable(HOST)).toBe(true);
  });
});

describe('robots.txt', () => {
  it('allows the site, disallows the private prefixes and points at the sitemap', () => {
    const txt = buildRobotsTxt(`${SITE}/`, true);
    expect(txt).toContain('User-agent: *\nAllow: /');
    for (const p of NOINDEX_PREFIXES) expect(txt).toContain(`Disallow: ${p}\n`);
    expect(txt).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(txt).not.toContain('Disallow: /\n');
  });
  it('a non-indexable build disallows everything and has no sitemap', () => {
    const txt = buildRobotsTxt(SITE, false);
    expect(txt).toBe('User-agent: *\nDisallow: /\n');
  });
  it('omits the Sitemap line without a site URL', () => {
    expect(buildRobotsTxt('', true)).not.toContain('Sitemap:');
  });
});

describe('sitemap.xml', () => {
  it('lists only the public pages with absolute URLs', () => {
    const xml = buildSitemapXml(SITE, '2026-11-01');
    expect(xml).not.toBeNull();
    for (const p of PUBLIC_PAGES) expect(xml).toContain(`<loc>${SITE}${p.path}</loc>`);
    for (const p of NOINDEX_PREFIXES) expect(xml).not.toContain(`<loc>${SITE}${p}`);
    expect(xml).toContain('<lastmod>2026-11-01</lastmod>');
    expect(xml).toContain('<priority>1.0</priority>');
  });
  it('is not produced without a site URL', () => {
    expect(buildSitemapXml('', '2026-11-01')).toBeNull();
  });
});

describe('structured data', () => {
  it('the landing page carries Organization, WebSite, WebPage and the FAQ', () => {
    const [ld] = jsonLdFor(SITE, '/') as Array<{ '@graph': Array<Record<string, unknown>> }>;
    const types = ld['@graph'].map((n) => n['@type']);
    expect(types).toEqual(['Organization', 'WebSite', 'WebPage', 'FAQPage']);
    const faq = ld['@graph'][3] as { mainEntity: Array<{ name: string }> };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(LANDING_FAQS.map((f) => f.question));
  });
  it('other public pages have no FAQ; private pages have no structured data', () => {
    const [ld] = jsonLdFor(SITE, '/pricing') as Array<{ '@graph': Array<Record<string, unknown>> }>;
    expect(ld['@graph'].map((n) => n['@type'])).toEqual(['Organization', 'WebSite', 'WebPage']);
    expect(jsonLdFor(SITE, '/signin')).toEqual([]);
  });
});

describe('head tags', () => {
  const find = (tags: ReturnType<typeof headTagsFor>, key: string, value: string) =>
    tags.find((t) => t.attrs.name === value || t.attrs.property === value || t.attrs.rel === value || (key === 'tag' && t.tag === value));

  it('a public page gets index/follow, canonical, Open Graph, Twitter and JSON-LD', () => {
    const tags = headTagsFor('/pricing', ORIGIN, HOST);
    expect(find(tags, 'tag', 'title')?.text).toMatch(/^Pricing – AI AdAstra$/);
    expect(find(tags, '', 'robots')?.attrs.content).toMatch(/^index, follow/);
    expect(find(tags, '', 'canonical')?.attrs.href).toBe(`${SITE}/pricing`);
    expect(find(tags, '', 'og:url')?.attrs.content).toBe(`${SITE}/pricing`);
    expect(find(tags, '', 'og:image')?.attrs.content).toBe(`${SITE}/images/og-aiastra.png`);
    expect(find(tags, '', 'twitter:card')?.attrs.content).toBe('summary_large_image');
    expect(tags.some((t) => t.tag === 'script' && t.attrs.type === 'application/ld+json')).toBe(true);
  });
  it('a sign-in or app page is noindex/nofollow with no canonical and no JSON-LD', () => {
    for (const p of ['/signin', '/signup', '/dashboard/chat', '/profile']) {
      const tags = headTagsFor(p, ORIGIN, HOST);
      expect(find(tags, '', 'robots')?.attrs.content, p).toBe('noindex, nofollow');
      expect(find(tags, '', 'canonical'), p).toBeUndefined();
      expect(tags.some((t) => t.tag === 'script'), p).toBe(false);
    }
  });
  it('a public page on an Amplify preview host is noindex', () => {
    const tags = headTagsFor('/', 'https://main.d20sdo476h9w6c.amplifyapp.com', 'main.d20sdo476h9w6c.amplifyapp.com');
    expect(find(tags, '', 'robots')?.attrs.content).toBe('noindex, nofollow');
  });
  it('applySeo replaces the owned tags on each route change and leaves the rest of the head alone', () => {
    const doc = document.implementation.createHTMLDocument('x');
    const keep = doc.createElement('meta');
    keep.setAttribute('name', 'viewport');
    doc.head.appendChild(keep);
    const stale = doc.createElement('meta');
    stale.setAttribute('name', 'description');
    stale.setAttribute('data-seo', '');
    doc.head.appendChild(stale);

    applySeo(doc, '/terms', ORIGIN, HOST);
    expect(doc.title).toBe('Terms of Service – AI AdAstra');
    expect(doc.head.querySelectorAll('meta[name="description"]').length).toBe(1);
    expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${SITE}/terms`);
    expect(doc.head.querySelector('meta[name="viewport"]')).toBe(keep);

    applySeo(doc, '/signin', ORIGIN, HOST);
    expect(doc.title).toBe('Sign in – AI AdAstra');
    expect(doc.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
    expect(doc.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(doc.head.querySelectorAll('meta[name="description"]').length).toBe(1);
  });
});
