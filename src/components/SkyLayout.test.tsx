import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import SkyLayout from './SkyLayout';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<SkyLayout />}>
          <Route path="/" element={<Link to="/signin">go sign in</Link>} />
          <Route path="/signin" element={<p>the sign-in form</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe('the shared sky', () => {
  it('pins one scene behind the page, hidden from screen readers, and loads only that scene', () => {
    const { container } = renderAt('/');
    const sky = container.querySelector('[data-test-id="cosmic-sky"]');
    expect(sky).toHaveAttribute('aria-hidden', 'true');
    expect(sky?.className).toMatch(/fixed/);
    expect(sky?.querySelectorAll('img')).toHaveLength(1);
    expect(sky?.querySelector('img')).toHaveAttribute('src', '/skies/ashwini.webp');
    const caption = container.querySelector('[data-test-id="sky-caption"]');
    expect(caption).toHaveTextContent('अश्विनी · Ashwini');
    expect(caption).toHaveTextContent('घोड़ा · the horse');
    expect(caption).toHaveTextContent('मेष Aries');
    expect(container.querySelectorAll('.shooting-star')).toHaveLength(3);
  });

  it('keeps the same sky and image when moving to sign-in, and changes only the page', () => {
    const { container } = renderAt('/');
    const sky = container.querySelector('[data-test-id="cosmic-sky"]');
    const img = sky?.querySelector('img');
    const page = container.querySelector('[data-test-id="sky-page"]');
    fireEvent.click(screen.getByText('go sign in'));
    expect(screen.getByText('the sign-in form')).toBeInTheDocument();
    expect(container.querySelector('[data-test-id="cosmic-sky"]')).toBe(sky);
    expect(sky?.querySelector('img')).toBe(img);
    expect(container.querySelector('[data-test-id="sky-page"]')).not.toBe(page);
  });
});
