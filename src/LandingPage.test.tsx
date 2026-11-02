import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import LandingPage from './LandingPage';
import { LANDING_FAQS } from './lib/landingFaqs';

describe('LandingPage', () => {
  it('says how much chart data is available, without an accuracy claim', () => {
    render(<LandingPage onSignUp={vi.fn()} />);
    const block = screen.getByRole('region', { name: 'About 9,500 records of astrological data for your chart' });
    expect(block).toHaveTextContent('about 9,500 records of astrological data, available for every chart');
    expect(block.textContent).not.toMatch(/per reading/i);
    expect(block.textContent).not.toMatch(/accura|precis/i);
    expect(within(block).queryByRole('button')).not.toBeInTheDocument();
  });

  it('is the hero, the data block and the questions, with one call to action wording', () => {
    const onSignUp = vi.fn();
    render(<LandingPage onSignUp={onSignUp} />);
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Discover Your Cosmic Blueprint',
      'About 9,500 records of astrological data for your chart',
      'Common questions',
    ]);
    const cta = screen.getAllByRole('button', { name: 'Generate My Chart' });
    expect(cta).toHaveLength(2);
    fireEvent.click(cta[0]!);
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });

  it('paints no background of its own, so the shared sky shows through', () => {
    const { container } = render(<LandingPage onSignUp={vi.fn()} />);
    expect((container.firstChild as HTMLElement).className).not.toMatch(/bg-/);
  });

  it('keeps every FAQ on the page, which the FAQPage structured data relies on', () => {
    render(<LandingPage onSignUp={vi.fn()} />);
    for (const faq of LANDING_FAQS) expect(screen.getByRole('button', { name: faq.question })).toBeInTheDocument();
    const first = screen.getByRole('button', { name: LANDING_FAQS[0]!.question });
    expect(first).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
  });
});
