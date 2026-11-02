/**
 * What search engines may see. Pure data and builders, no DOM and no `import.meta.env`, so the Vite build (robots.txt,
 * sitemap.xml) and the browser (SeoHead) share one source of truth.
 *
 * Public pages are indexed with their own title, description and canonical URL. Everything behind the sign-in, and the
 * sign-in and sign-up pages themselves, is `noindex, nofollow`: nothing on those pages is for a search result.
 */
import { LANDING_FAQS } from './landingFaqs';

export const PRODUCT_NAME = 'AI AdAstra';
export const DEFAULT_DESCRIPTION =
  'Ask me your curiosity, your questions and see what your own birth chart has in store for you, rarely considered or seen the Vedic astrological celestial sky';
/** Served from /public: 1200x630, made by scripts/generate-og-image.mjs. */
export const DEFAULT_OG_IMAGE = '/images/og-aiastra.png';
export const DEFAULT_LOCALE = 'en_US';

/** One tag for `<head>`, as data: `headTagsFor()` makes them, the browser and the prerender each write them. */
export interface HeadTag {
  tag: 'title' | 'meta' | 'link' | 'script';
  attrs: Record<string, string>;
  text?: string;
}

export interface PageSeo {
  /** Full `<title>`. Public pages end with the product name; private pages carry only a label. */
  title: string;
  description: string;
  /** Path without query or hash, as it appears in the sitemap and canonical link. */
  path: string;
  index: boolean;
  /** Sitemap hint. */
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
}

/** Pages a search engine may list. Order is the sitemap order. */
export const PUBLIC_PAGES: ReadonlyArray<PageSeo> = [
  {
    path: '/',
    title: `Your personal Vedic Astrology Assistant, mastered on the ancient text unabridged and astrological celestial sky - ${PRODUCT_NAME}`,
    description: DEFAULT_DESCRIPTION,
    index: true,
    changefreq: 'weekly',
    priority: 1,
  },
  {
    path: '/pricing',
    title: `Pricing – ${PRODUCT_NAME}`,
    description: `Plans and prices for ${PRODUCT_NAME}, shown in your region's currency. Compare the questions a month on each plan before you sign up.`,
    index: true,
    changefreq: 'weekly',
    priority: 0.8,
  },
  {
    path: '/terms',
    title: `Terms of Service – ${PRODUCT_NAME}`,
    description: `The terms that govern your use of ${PRODUCT_NAME}: an education and entertainment service, not advice of any kind.`,
    index: true,
    changefreq: 'monthly',
    priority: 0.3,
  },
  {
    path: '/privacy',
    title: `Privacy Policy – ${PRODUCT_NAME}`,
    description: `How ${PRODUCT_NAME} collects, uses and protects your birth details, questions and account information.`,
    index: true,
    changefreq: 'monthly',
    priority: 0.3,
  },
  {
    path: '/refunds',
    title: `Refund Policy – ${PRODUCT_NAME}`,
    description: `When and how ${PRODUCT_NAME} refunds a paid plan, and how to ask for a refund.`,
    index: true,
    changefreq: 'monthly',
    priority: 0.3,
  },
];

/** Prerendered for speed like the public pages, but never indexed and not in the sitemap. */
export const PRERENDERED_PRIVATE_PATHS: ReadonlyArray<string> = ['/signin', '/signup'];

/**
 * Path prefixes that are never indexed: the sign-in and sign-up flow and the signed-in app. Listed in robots.txt as
 * `Disallow`, sent as `X-Robots-Tag: noindex` by the host, and rendered as `<meta name="robots" content="noindex">`.
 */
export const NOINDEX_PREFIXES: ReadonlyArray<string> = ['/signin', '/signup', '/dashboard', '/profile'];

/** Titles for the private pages, so the browser tab reads well even though search engines skip them. */
const PRIVATE_TITLES: ReadonlyArray<{ prefix: string; title: string }> = [
  { prefix: '/signup/details', title: `Your birth details – ${PRODUCT_NAME}` },
  { prefix: '/signup', title: `Sign up – ${PRODUCT_NAME}` },
  { prefix: '/signin', title: `Sign in – ${PRODUCT_NAME}` },
  { prefix: '/dashboard/charts', title: `Your charts – ${PRODUCT_NAME}` },
  { prefix: '/dashboard/mantras', title: `Mantras – ${PRODUCT_NAME}` },
  { prefix: '/dashboard/remedies', title: `Remedies – ${PRODUCT_NAME}` },
  { prefix: '/dashboard', title: `Ask about your chart – ${PRODUCT_NAME}` },
  { prefix: '/profile', title: `Your profile – ${PRODUCT_NAME}` },
];

function normalizePath(pathname: string): string {
  const noQuery = pathname.split(/[?#]/)[0] || '/';
  const trimmed = noQuery.length > 1 ? noQuery.replace(/\/+$/, '') : noQuery;
  return trimmed || '/';
}

function startsWithPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isNoindexPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return NOINDEX_PREFIXES.some((p) => startsWithPrefix(path, p));
}

/** The SEO record for a path. Unknown paths are not indexed: the router sends them to sign-in or the dashboard. */
export function pageSeoFor(pathname: string): PageSeo {
  const path = normalizePath(pathname);
  const pub = PUBLIC_PAGES.find((p) => p.path === path);
  if (pub) return pub;
  const priv = PRIVATE_TITLES.find((p) => startsWithPrefix(path, p.prefix));
  return { path, title: priv?.title ?? PRODUCT_NAME, description: DEFAULT_DESCRIPTION, index: false };
}

/**
 * Hosts that must never be indexed, whatever the build flag says: local dev and the Amplify preview domains. The
 * production domain is set by `VITE_SITE_URL`, which the build also uses for the sitemap.
 */
export function hostIsIndexable(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (!h || h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return false;
  if (h.endsWith('.amplifyapp.com') || h.endsWith('.localhost') || h.endsWith('.test')) return false;
  return true;
}

export function robotsContent(index: boolean): string {
  return index ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, nofollow';
}

export function trimSiteUrl(siteUrl: string | undefined): string {
  return (siteUrl ?? '').trim().replace(/\/+$/, '');
}

export function absoluteUrl(siteUrl: string, path: string): string {
  return `${trimSiteUrl(siteUrl)}${normalizePath(path)}`;
}

/** robots.txt for the build. A non-indexable build (staging, previews) disallows everything. */
export function buildRobotsTxt(siteUrl: string, indexable: boolean): string {
  const lines = ['User-agent: *'];
  if (!indexable) {
    lines.push('Disallow: /');
  } else {
    lines.push('Allow: /');
    for (const p of NOINDEX_PREFIXES) lines.push(`Disallow: ${p}`);
    const base = trimSiteUrl(siteUrl);
    if (base) lines.push('', `Sitemap: ${base}/sitemap.xml`);
  }
  return `${lines.join('\n')}\n`;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** sitemap.xml for the build: public pages only. Needs the absolute site URL; returns null without one. */
export function buildSitemapXml(siteUrl: string, lastmod: string): string | null {
  const base = trimSiteUrl(siteUrl);
  if (!base) return null;
  const urls = PUBLIC_PAGES.filter((p) => p.index).map((p) => {
    const parts = [`<loc>${xmlEscape(absoluteUrl(base, p.path))}</loc>`, `<lastmod>${lastmod}</lastmod>`];
    if (p.changefreq) parts.push(`<changefreq>${p.changefreq}</changefreq>`);
    if (p.priority !== undefined) parts.push(`<priority>${p.priority.toFixed(1)}</priority>`);
    return `  <url>\n    ${parts.join('\n    ')}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

type JsonLd = Record<string, unknown>;

/** Structured data for a path: Organization and WebSite everywhere public, FAQPage on the landing page. */
export function jsonLdFor(siteUrl: string, pathname: string): JsonLd[] {
  const page = pageSeoFor(pathname);
  if (!page.index) return [];
  const base = trimSiteUrl(siteUrl);
  const org: JsonLd = {
    '@type': 'Organization',
    '@id': `${base}/#organization`,
    name: PRODUCT_NAME,
    url: `${base}/`,
    logo: `${base}${DEFAULT_OG_IMAGE}`,
  };
  const site: JsonLd = {
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    name: PRODUCT_NAME,
    url: `${base}/`,
    inLanguage: 'en',
    publisher: { '@id': `${base}/#organization` },
  };
  const webPage: JsonLd = {
    '@type': 'WebPage',
    '@id': `${absoluteUrl(base, page.path)}#webpage`,
    url: absoluteUrl(base, page.path),
    name: page.title,
    description: page.description,
    inLanguage: 'en',
    isPartOf: { '@id': `${base}/#website` },
  };
  const graph: JsonLd[] = [org, site, webPage];
  if (page.path === '/') {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${base}/#faq`,
      mainEntity: LANDING_FAQS.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }
  return [{ '@context': 'https://schema.org', '@graph': graph }];
}
