/**
 * Browser side of SEO: the build flags, and writing the head tags for the current route. React 18 does not hoist
 * `<title>` or `<meta>` from components, so the tags are written to `document.head` directly. Every tag this module
 * owns carries `data-seo`, so a route change replaces only those.
 */
import {
  DEFAULT_LOCALE,
  DEFAULT_OG_IMAGE,
  PRODUCT_NAME,
  absoluteUrl,
  hostIsIndexable,
  jsonLdFor,
  pageSeoFor,
  robotsContent,
  trimSiteUrl,
} from './seoConfig';

/** Absolute site URL for canonical links and the sitemap. Unset builds fall back to the page origin at runtime. */
export const SITE_URL = trimSiteUrl(import.meta.env.VITE_SITE_URL as string | undefined);
/** `VITE_SEO_INDEX=0` marks a build (staging) as never indexable. */
export const BUILD_INDEXABLE = String(import.meta.env.VITE_SEO_INDEX ?? '1').trim() !== '0';

export function siteUrlFor(origin: string): string {
  return SITE_URL || trimSiteUrl(origin);
}

export interface HeadTag {
  tag: 'title' | 'meta' | 'link' | 'script';
  attrs: Record<string, string>;
  text?: string;
}

/** The head tags for a route, as data: tested without a DOM, then written by `applySeo`. */
export function headTagsFor(pathname: string, origin: string, hostname: string): HeadTag[] {
  const page = pageSeoFor(pathname);
  const siteUrl = siteUrlFor(origin);
  const index = page.index && BUILD_INDEXABLE && hostIsIndexable(hostname);
  const url = absoluteUrl(siteUrl, page.path);
  const image = `${siteUrl}${DEFAULT_OG_IMAGE}`;
  const tags: HeadTag[] = [
    { tag: 'title', attrs: {}, text: page.title },
    { tag: 'meta', attrs: { name: 'description', content: page.description } },
    { tag: 'meta', attrs: { name: 'robots', content: robotsContent(index) } },
    { tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
    { tag: 'meta', attrs: { property: 'og:site_name', content: PRODUCT_NAME } },
    { tag: 'meta', attrs: { property: 'og:locale', content: DEFAULT_LOCALE } },
    { tag: 'meta', attrs: { property: 'og:title', content: page.title } },
    { tag: 'meta', attrs: { property: 'og:description', content: page.description } },
    { tag: 'meta', attrs: { property: 'og:url', content: url } },
    { tag: 'meta', attrs: { property: 'og:image', content: image } },
    { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
    { tag: 'meta', attrs: { name: 'twitter:title', content: page.title } },
    { tag: 'meta', attrs: { name: 'twitter:description', content: page.description } },
    { tag: 'meta', attrs: { name: 'twitter:image', content: image } },
  ];
  if (index) {
    tags.push({ tag: 'link', attrs: { rel: 'canonical', href: url } });
    for (const ld of jsonLdFor(siteUrl, page.path)) {
      tags.push({ tag: 'script', attrs: { type: 'application/ld+json' }, text: JSON.stringify(ld) });
    }
  }
  return tags;
}

const OWNED = 'data-seo';

/** Replace the head tags this module owns with the ones for `pathname`. Static defaults in index.html are removed too. */
export function applySeo(doc: Document, pathname: string, origin: string, hostname: string): void {
  const head = doc.head;
  for (const el of Array.from(head.querySelectorAll(`[${OWNED}]`))) el.remove();
  for (const tag of headTagsFor(pathname, origin, hostname)) {
    if (tag.tag === 'title') {
      doc.title = tag.text ?? '';
      continue;
    }
    const el = doc.createElement(tag.tag);
    for (const [k, v] of Object.entries(tag.attrs)) el.setAttribute(k, v);
    if (tag.text !== undefined) el.textContent = tag.text;
    el.setAttribute(OWNED, '');
    head.appendChild(el);
  }
}
