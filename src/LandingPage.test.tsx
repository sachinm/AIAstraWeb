import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import LandingPage from './LandingPage';

describe('LandingPage', () => {
  it('says how much chart data is available, without an accuracy claim', () => {
    render(<LandingPage onSignUp={vi.fn()} />);
    const block = screen.getByRole('region', { name: 'About 9,500 records of astrological data for your chart' });
    expect(block).toHaveTextContent('about 9,500 records of astrological data, available for every chart');
    expect(block.textContent).not.toMatch(/per reading/i);
    expect(block.textContent).not.toMatch(/accura|precis/i);
    expect(within(block).queryByRole('button')).not.toBeInTheDocument();
  });
});
