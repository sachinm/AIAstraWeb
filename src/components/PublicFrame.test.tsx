import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicFrame from './PublicFrame';

const show = (path: string, nav?: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PublicFrame nav={nav}>
        <p>page body</p>
      </PublicFrame>
    </MemoryRouter>,
  );

describe('PublicFrame', () => {
  it('holds the page between a header and a footer, and only the middle scrolls', () => {
    show('/');
    expect(screen.getByRole('banner')).toHaveTextContent('AdAstra AI');
    expect(document.querySelector('[data-test-id="header-tagline"]')).toHaveTextContent('Your personal Vedic astrologer.');
    expect(screen.getByRole('main')).toHaveTextContent('page body');
    expect(screen.getByRole('main')).toHaveClass('overflow-y-auto');
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/for education and entertainment/i);
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
  });

  it('offers Get Started, and no Sign in or Pricing, on the main page', () => {
    show('/');
    expect(screen.getByRole('link', { name: /get started/i })).toHaveAttribute('href', '/signin');
    expect(screen.queryByText(/^sign in$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^pricing$/i)).not.toBeInTheDocument();
  });

  it.each(['/signin', '/signup'])('leaves Get Started off %s', (path) => {
    show(path);
    expect(screen.queryByRole('link', { name: /get started/i })).not.toBeInTheDocument();
  });

  it('uses the signed-in nav in place of the public header', () => {
    show('/pricing', <nav>signed-in nav</nav>);
    expect(screen.getByText('signed-in nav')).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });
});
