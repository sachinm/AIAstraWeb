import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyPage, RefundsPage, TermsPage } from './LegalPages';

const show = (page: React.ReactElement) => render(<MemoryRouter>{page}</MemoryRouter>);

describe('legal pages', () => {
  it('the terms lead with education and entertainment, and no advice or lifestyle opinion', () => {
    show(<TermsPage />);
    const first = screen.getAllByRole('heading', { level: 2 })[0];
    expect(first).toHaveTextContent(/education and entertainment only/i);
    expect(screen.getByText(/nothing in the service is, or is meant to be, advice of any type or a lifestyle opinion/i)).toBeInTheDocument();
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
