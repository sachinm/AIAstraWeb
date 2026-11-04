import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SeoHead from './SeoHead';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SeoHead />
      <Routes>
        <Route path="*" element={<div>page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute('content');

describe('SeoHead', () => {
  it('sets the title and robots for the route it is rendered on', () => {
    renderAt('/signup');
    expect(document.title).toBe('Sign up – AdAstra AI');
    expect(robots()).toBe('noindex, nofollow');
  });
  it('a public route on the jsdom localhost host is still noindex (never index a local build)', () => {
    renderAt('/pricing');
    expect(document.title).toBe('Pricing – AdAstra AI');
    expect(robots()).toBe('noindex, nofollow');
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Pricing – AdAstra AI');
  });
});
