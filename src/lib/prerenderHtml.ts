/**
 * HTML side of the build-time prerender: turn `headTagsFor()` output into markup, and put that and the rendered page
 * into the built `index.html`. Pure string work, so it is tested without a build.
 */
import type { HeadTag } from './seoConfig';

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Head tags as HTML. Every tag except `<title>` carries `data-seo`, so the runtime `applySeo` replaces them on the first route. */
export function renderHeadTags(tags: HeadTag[]): string {
  return tags
    .map((t) => {
      if (t.tag === 'title') return `<title>${escapeText(t.text ?? '')}</title>`;
      const attrs = Object.entries(t.attrs)
        .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
        .join('');
      if (t.tag === 'script') {
        // A JSON unicode escape for `<` keeps the JSON identical once parsed, and stops a closing script tag in the text ending the element early.
        return `<script${attrs} data-seo>${(t.text ?? '').replace(/</g, '\\u003c')}</script>`;
      }
      return `<${t.tag}${attrs} data-seo />`;
    })
    .join('\n    ');
}

/**
 * The built SPA shell with `markup` inside `#root` and this route's head tags in place of the shell's defaults (its
 * `<title>` and every `data-seo` tag, including the build's default robots meta and canonical).
 */
export function injectPage(template: string, markup: string, tags: HeadTag[]): string {
  const rootOpen = '<div id="root"></div>';
  if (!template.includes(rootOpen)) throw new Error('prerender: index.html has no empty <div id="root"></div>');
  const titleRe = /<title>[\s\S]*?<\/title>/;
  if (!titleRe.test(template)) throw new Error('prerender: index.html has no <title>');
  const block = renderHeadTags(tags);
  return template
    .replace(/[ \t]*<(?:meta|link)\b[^>]*\bdata-seo\b[^>]*>[ \t]*\r?\n?/g, '')
    .replace(titleRe, () => block)
    .replace(rootOpen, () => `<div id="root">${markup}</div>`);
}

/** Output files for a public path: `/` is `index.html`; `/terms` is `terms/index.html` plus a `terms.html` copy (see `prerenderFiles` docs). */
export function prerenderFiles(path: string): string[] {
  if (path === '/') return ['index.html'];
  const p = path.replace(/^\/+|\/+$/g, '');
  return [`${p}/index.html`, `${p}.html`];
}
