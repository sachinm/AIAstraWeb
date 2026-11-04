import { afterEach, describe, expect, it } from 'vitest';
import { installAuthPrewarm, resetPrewarmForTests, TURNSTILE_SCRIPT_URL } from './prewarm';

const prefetches = () => document.head.querySelectorAll(`link[rel="prefetch"][href="${TURNSTILE_SCRIPT_URL}"]`);

describe('installAuthPrewarm', () => {
  let remove = () => {};
  afterEach(() => {
    remove();
    resetPrewarmForTests();
    document.head.querySelectorAll('link[rel="prefetch"]').forEach((l) => l.remove());
    document.body.innerHTML = '';
  });

  it('makes no Cloudflare request for someone who never heads for sign-up', () => {
    document.body.innerHTML = '<a href="/pricing">Pricing</a>';
    remove = installAuthPrewarm();
    document.querySelector('a')!.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(prefetches()).toHaveLength(0);
  });

  it.each([
    ['a sign-up link', '<a href="/signup"><span>Get Started</span></a>', 'pointerover'],
    ['a sign-in link', '<a href="/signin">Sign in</a>', 'focusin'],
    ['a button that navigates in code', '<button data-auth-intent>Generate My Chart</button>', 'touchstart'],
  ])('prefetches the script once on %s', (_name, html, type) => {
    document.body.innerHTML = html;
    remove = installAuthPrewarm();
    const el = document.body.querySelector('span, a, button')!;
    el.dispatchEvent(new Event(type, { bubbles: true }));
    el.dispatchEvent(new Event(type, { bubbles: true }));
    expect(prefetches()).toHaveLength(1);
  });
});
