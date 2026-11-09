#!/usr/bin/env node
/**
 * Light theme for a dark-first app. The pages were drawn for the night sky (white words, white-tinted glass), so rather
 * than add a `dark:` twin to every colour class in ~80 files, this script reads which colour utilities the source uses
 * and writes their light-mode equivalents under `html.light` into src/theme-light.css:
 *
 *   text-white/70      -> slate-900 at the same strength
 *   text-purple-200    -> purple-800 (pale tints turn into deep ones)
 *   bg-white/10        -> a faint slate tint
 *   border-white/15    -> a faint slate line
 *   bg-slate-900/95    -> white/95 (menus and sheets)
 *
 * Words on a solid colour (a purple or pink button, a red badge) stay as they are: those buttons look the same in both
 * themes. So does anything inside `.keep-dark`.
 *
 * Run `node scripts/gen-light-theme.mjs` after adding colour classes; src/lib/theme.test.ts fails while the file is stale.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HUES = [
  'gray', 'slate', 'zinc', 'neutral', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
];
const NEUTRAL = new Set(['gray', 'slate', 'zinc', 'neutral']);

/** Tailwind 3 default palette, the shades this script writes. */
const PALETTE = {
  slate: { 300: '203 213 225', 400: '148 163 184', 500: '100 116 139', 600: '71 85 105', 700: '51 65 85', 800: '30 41 59', 900: '15 23 42' },
  red: { 600: '220 38 38', 700: '185 28 28', 800: '153 27 27' },
  orange: { 600: '234 88 12', 700: '194 65 12', 800: '154 52 18' },
  amber: { 600: '217 119 6', 700: '180 83 9', 800: '146 64 14' },
  yellow: { 600: '202 138 4', 700: '161 98 7', 800: '133 77 14' },
  lime: { 600: '101 163 13', 700: '77 124 15', 800: '63 98 18' },
  green: { 600: '22 163 74', 700: '21 128 61', 800: '22 101 52' },
  emerald: { 600: '5 150 105', 700: '4 120 87', 800: '6 95 70' },
  teal: { 600: '13 148 136', 700: '15 118 110', 800: '17 94 89' },
  cyan: { 600: '8 145 178', 700: '14 116 144', 800: '21 94 117' },
  sky: { 600: '2 132 199', 700: '3 105 161', 800: '7 89 133' },
  blue: { 600: '37 99 235', 700: '29 78 216', 800: '30 64 175' },
  indigo: { 600: '79 70 229', 700: '67 56 202', 800: '55 48 163' },
  violet: { 600: '124 58 237', 700: '109 40 217', 800: '91 33 182' },
  purple: { 600: '147 51 234', 700: '126 34 206', 800: '107 33 168' },
  fuchsia: { 600: '192 38 211', 700: '162 28 175', 800: '134 25 143' },
  pink: { 600: '219 39 119', 700: '190 24 93', 800: '157 23 77' },
  rose: { 600: '225 29 72', 700: '190 18 60', 800: '159 18 57' },
};

const TOKEN = new RegExp(
  String.raw`(?<![\w-])((?:(?:hover|focus|focus-visible|active|group-hover|disabled|sm|md|lg|xl):)*)(!?)` +
    String.raw`(text|bg|border|border-[trblxy]|ring|divide|placeholder|fill|stroke|from|via|to|outline)-` +
    String.raw`(white|black|\[#[0-9a-fA-F]{3,6}\]|${HUES.join('|')})(?:-(\d{2,3}))?(?:\/(\d{1,3}))?(?![\w/\]-])`,
  'g',
);

const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 };
const PSEUDO = { hover: ':hover', focus: ':focus', 'focus-visible': ':focus-visible', active: ':active', disabled: ':disabled' };

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

/** True for an arbitrary hex colour like [#0b0a1f] that is dark (the night-sky panels). */
function isDarkHex(color) {
  const m = /^\[#([0-9a-fA-F]{3,6})\]$/.exec(color);
  if (!m) return false;
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 60;
}

/** The light-mode colour for one utility, or null to leave it alone. */
function lightColor(util, color, shade, alpha) {
  const a = alpha == null ? 1 : alpha / 100;
  if (color.startsWith('[')) {
    if (!isDarkHex(color)) return null;
    if (util === 'bg') return `rgb(255 255 255 / ${Math.max(a, 0.92)})`;
    if (util === 'from' || util === 'via' || util === 'to') return `rgb(248 247 255 / ${Math.min(0.85, a * 1.2)})`;
    return null;
  }
  const slate = (s, x) => `rgb(${PALETTE.slate[s]} / ${+x.toFixed(3)})`;
  const deep = (s) => (NEUTRAL.has(color) ? PALETTE.slate[s] : PALETTE[color]?.[s]);
  const isText = util === 'text' || util === 'placeholder' || util === 'fill' || util === 'stroke';

  if (isText) {
    if (color === 'white') return slate(900, Math.max(a, util === 'text' ? 0.62 : 0.45));
    if (color === 'black') return null;
    if (shade == null || shade >= 500) return null;
    if (NEUTRAL.has(color)) {
      const s = shade <= 200 ? 800 : shade === 300 ? 700 : 600;
      return `rgb(${PALETTE.slate[s]} / ${Math.max(a, 0.75)})`;
    }
    const rgb = deep(shade <= 200 ? 800 : 700);
    return rgb ? `rgb(${rgb} / ${Math.max(a, 0.8)})` : null;
  }
  if (util === 'bg') {
    if (color === 'white') return alpha == null ? null : slate(900, Math.min(0.12, a * 0.55));
    if (color === 'black') return a >= 0.5 ? slate(900, a * 0.55) : 'rgb(255 255 255 / 0.6)';
    if (NEUTRAL.has(color) && shade >= 700) return `rgb(255 255 255 / ${Math.max(a, 0.9)})`;
    if (!NEUTRAL.has(color) && alpha != null && a <= 0.3 && shade <= 500) {
      // pale tints of a hue: a little stronger, or they vanish on white
      return `rgb(${deep(600)} / ${+Math.min(0.22, a * 1.1).toFixed(3)})`;
    }
    return null;
  }
  if (util.startsWith('border') || util === 'divide' || util === 'ring' || util === 'outline') {
    if (color === 'white') return slate(900, alpha == null ? 0.25 : Math.min(0.3, Math.max(0.08, a * 0.9)));
    if (NEUTRAL.has(color) && shade >= 600) return slate(900, 0.15);
    if (!NEUTRAL.has(color) && shade != null && shade <= 400) {
      const rgb = deep(600);
      return rgb ? `rgb(${rgb} / ${alpha == null ? 0.7 : Math.min(1, a * 1.4)})` : null;
    }
    return null;
  }
  if (util === 'from' || util === 'via' || util === 'to') {
    if (color === 'black') return `rgb(255 255 255 / ${Math.min(0.85, a * 1.5)})`;
    return null;
  }
  return null;
}

function declarations(util, value) {
  switch (util) {
    case 'text':
      return `color: ${value}`;
    case 'placeholder':
      return `color: ${value}`;
    case 'bg':
      return `background-color: ${value}`;
    case 'border':
      return `border-color: ${value}`;
    case 'border-t':
      return `border-top-color: ${value}`;
    case 'border-b':
      return `border-bottom-color: ${value}`;
    case 'border-l':
      return `border-left-color: ${value}`;
    case 'border-r':
      return `border-right-color: ${value}`;
    case 'border-x':
      return `border-left-color: ${value}; border-right-color: ${value}`;
    case 'border-y':
      return `border-top-color: ${value}; border-bottom-color: ${value}`;
    case 'divide':
      return `border-color: ${value}`;
    case 'ring':
      return `--tw-ring-color: ${value}`;
    case 'outline':
      return `outline-color: ${value}`;
    case 'fill':
      return `fill: ${value}`;
    case 'stroke':
      return `stroke: ${value}`;
    case 'from': {
      const clear = value.replace(/\/ [\d.]+\)$/, '/ 0)');
      return `--tw-gradient-from: ${value} var(--tw-gradient-from-position); --tw-gradient-to: ${clear} var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to)`;
    }
    case 'via': {
      const clear = value.replace(/\/ [\d.]+\)$/, '/ 0)');
      return `--tw-gradient-to: ${clear} var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), ${value} var(--tw-gradient-via-position), var(--tw-gradient-to)`;
    }
    case 'to':
      return `--tw-gradient-to: ${value} var(--tw-gradient-to-position)`;
    default:
      return null;
  }
}

const esc = (cls) => cls.replace(/([:/!.[\]#])/g, '\\$1');

export function generate(srcDir) {
  const files = walk(srcDir);
  const found = new Map();
  /** solid colours words sit on: their own text colours stay */
  const accents = new Set();
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(TOKEN)) {
      const [, variants, bang, util, color, shadeStr, alphaStr] = m;
      const shade = shadeStr ? +shadeStr : null;
      const alpha = alphaStr ? +alphaStr : null;
      const base = m[0].slice(variants.length + bang.length);
      if (!variants && (util === 'bg' || util === 'from') && !NEUTRAL.has(color) && color !== 'white' && color !== 'black' && shade >= 500 && (alpha == null || alpha >= 60)) {
        accents.add(base);
      }
      found.set(m[0], { variants: variants ? variants.slice(0, -1).split(':') : [], bang: !!bang, util, color, shade, alpha });
    }
  }

  const accentList = [...accents].sort().map((c) => `[class~='${c}']`);
  const shielded = [...accentList, '.keep-dark', '.parchment'];
  const not = `:not(:where(${shielded.join(', ')}, ${shielded.map((s) => `${s} *`).join(', ')}))`;

  const plain = [];
  const media = {};
  for (const [cls, t] of [...found].sort(([a], [b]) => a.localeCompare(b))) {
    const value = lightColor(t.util, t.color, t.shade, t.alpha);
    if (!value) continue;
    let decl = declarations(t.util, value);
    if (!decl) continue;
    if (t.bang) decl = decl.split('; ').map((d) => `${d} !important`).join('; ');
    let sel = `.${esc(cls)}`;
    let prefix = 'html.light ';
    let bp = null;
    for (const v of t.variants) {
      if (PSEUDO[v]) sel += PSEUDO[v];
      else if (v === 'group-hover') prefix += '.group:hover ';
      else if (BREAKPOINTS[v]) bp = BREAKPOINTS[v];
    }
    const isTextish = ['text', 'placeholder', 'fill', 'stroke'].includes(t.util);
    if (t.util === 'placeholder') sel += '::placeholder';
    if (t.util === 'divide') sel += ' > :not([hidden]) ~ :not([hidden])';
    const full = isTextish && t.util !== 'placeholder' ? `${prefix}${sel}${not}` : `${prefix}${sel}`;
    const rule = `${full} { ${decl}; }`;
    if (bp) (media[bp] ||= []).push(`  ${rule}`);
    else plain.push(rule);
  }

  const out = [
    '/* Generated by scripts/gen-light-theme.mjs from the colour classes in src/. Do not edit by hand. */',
    ...plain,
    ...Object.entries(media).map(([w, rules]) => `@media (min-width: ${w}px) {\n${rules.join('\n')}\n}`),
    '',
  ];
  return out.join('\n');
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const root = resolve(here, '..');
  writeFileSync(join(root, 'src', 'theme-light.css'), generate(join(root, 'src')));
  console.log('wrote src/theme-light.css');
}
