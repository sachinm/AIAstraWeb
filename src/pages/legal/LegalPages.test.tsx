import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyPage, RefundsPage, TermsPage } from './LegalPages';
import { TERMS_VERSION } from '../../lib/legal';

const show = (page: React.ReactElement) => render(<MemoryRouter>{page}</MemoryRouter>);

describe('legal pages', () => {
  it('the terms lead with education and entertainment, and no advice or lifestyle opinion', () => {
    show(<TermsPage />);
    const first = screen.getAllByRole('heading', { level: 2 })[0];
    expect(first).toHaveTextContent(/education and entertainment only/i);
    expect(screen.getByText(/nothing in the service is, or is meant to be, advice of any type or a lifestyle opinion/i)).toBeInTheDocument();
  });

  it('the terms say what you see is for personal use only, never to be copied or recorded, and you must be 18 or older', () => {
    show(<TermsPage />);
    const heading = screen.getByRole('heading', { level: 2, name: /using what you see in the app/i });
    const section = heading.closest('section')!;
    expect(section).toHaveTextContent(/readings, charts, text, images and other content .* personal, private use only/i);
    expect(section).toHaveTextContent(
      /must not copy, screenshot for distribution, record, scrape, republish, resell or use them to train software, or otherwise reproduce them in any form, except as the law allows/i
    );
    expect(section).toHaveTextContent(/18 or older/);
    expect(screen.getByText(/last updated 8 november 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/also called our terms of use/i)).toBeInTheDocument();
    expect(TERMS_VERSION).toBe('2026-11-08');
  });

  it('privacy states no selling and no advertising, refunds render, and no support address is invented', () => {
    show(<PrivacyPage />);
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText(/we do not sell your personal information. we do not show advertising/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\S+@\S+\.\S+/);
    show(<RefundsPage />);
    expect(screen.getByRole('heading', { name: 'Refund Policy' })).toBeInTheDocument();
  });
});
