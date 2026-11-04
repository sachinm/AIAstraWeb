import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LandingPage, { BLUEPRINT_OPEN_MS } from './LandingPage';
import { LANDING_FAQS } from './lib/landingFaqs';

const scroll = (id: string) => document.querySelector(`[data-test-id="scroll-${id}"]`) as HTMLElement;
const isOpen = (id: string) => scroll(id).classList.contains('parchment-open');

describe('LandingPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('says how much chart data is available, without an accuracy claim', () => {
    render(<LandingPage onSignUp={vi.fn()} />);
    const block = scroll('records');
    expect(block).toHaveTextContent('about 9,500 records of astrological data, available for every chart');
    expect(block.textContent).not.toMatch(/per reading/i);
    expect(block.textContent).not.toMatch(/accura|precis/i);
  });

  it('is a scroll for each piece: tagline, blueprint, Jyotish, records and each question', () => {
    render(<LandingPage onSignUp={vi.fn()} />);
    const icons = document.querySelectorAll('.scroll-icon');
    expect(icons).toHaveLength(4 + LANDING_FAQS.length);
    expect([...document.querySelectorAll('h1, h2')].map((h) => h.textContent)).toEqual([
      'Discover Your Cosmic Blueprint',
      'About 9,500 records of astrological data for your chart',
      ...LANDING_FAQS.map((f) => f.question),
    ]);
  });

  it('opens on the blueprint, with its button, and rolls it up after ten seconds', () => {
    const onSignUp = vi.fn();
    render(<LandingPage onSignUp={onSignUp} />);
    expect(isOpen('blueprint')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Generate My Chart' }));
    expect(onSignUp).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(BLUEPRINT_OPEN_MS - 1));
    expect(isOpen('blueprint')).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(isOpen('blueprint')).toBe(false);
  });

  it('waits while someone has the pointer on the blueprint', () => {
    render(<LandingPage onSignUp={vi.fn()} />);
    fireEvent.pointerEnter(scroll('blueprint'));
    act(() => void vi.advanceTimersByTime(BLUEPRINT_OPEN_MS + 5000));
    expect(isOpen('blueprint')).toBe(true);
    fireEvent.pointerLeave(scroll('blueprint'));
    act(() => void vi.advanceTimersByTime(1000));
    expect(isOpen('blueprint')).toBe(false);
  });

  it('opens one scroll at a time, and Escape rolls it up', () => {
    render(<LandingPage onSignUp={vi.fn()} />);
    const records = screen.getByRole('button', { name: 'About 9,500 records for your chart' });
    fireEvent.click(records);
    expect(isOpen('records')).toBe(true);
    expect(isOpen('blueprint')).toBe(false);
    expect(records).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: LANDING_FAQS[0]!.question }));
    expect(isOpen('faq-0')).toBe(true);
    expect(isOpen('records')).toBe(false);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(isOpen('faq-0')).toBe(false);
  });

  it('does not roll up a scroll someone opened when the blueprint timer ends', () => {
    render(<LandingPage onSignUp={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explore Jyotish' }));
    act(() => void vi.advanceTimersByTime(BLUEPRINT_OPEN_MS + 1000));
    expect(isOpen('explore')).toBe(true);
  });

  it('rolls up on a click elsewhere on the page', () => {
    render(<LandingPage onSignUp={vi.fn()} />);
    fireEvent.pointerDown(document.body);
    expect(isOpen('blueprint')).toBe(false);
  });

  it('keeps every question and answer in the page while rolled up, which the FAQPage data relies on', () => {
    render(<LandingPage onSignUp={vi.fn()} />);
    for (const [i, faq] of LANDING_FAQS.entries()) {
      expect(screen.getByRole('button', { name: faq.question })).toHaveAttribute('aria-expanded', 'false');
      expect(scroll(`faq-${i}`)).toHaveTextContent(faq.answer);
    }
  });

  it('cannot scroll and paints no background of its own, so the shared sky shows through', () => {
    const { container } = render(<LandingPage onSignUp={vi.fn()} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/overflow-hidden/);
    expect(root.className).not.toMatch(/bg-/);
  });
});
