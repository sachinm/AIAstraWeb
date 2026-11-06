import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LifeReadingDashboard, { COLUMNS } from './LifeReadingDashboard';
import ProfileTimeline from '../profile/ProfileTimeline';
import * as api from '../../lib/lifeReadingApi';

vi.mock('../../lib/lifeReadingApi', async (orig) => ({
  ...(await orig<typeof import('../../lib/lifeReadingApi')>()),
  fetchLifeReading: vi.fn(),
}));
vi.mock('../../lib/pastReadingApi', async (orig) => ({
  ...(await orig<typeof import('../../lib/pastReadingApi')>()),
  fetchPastLifeReading: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../lib/ledgerApi', async (orig) => ({
  ...(await orig<typeof import('../../lib/ledgerApi')>()),
  fetchLedgerMeta: vi.fn().mockResolvedValue(null),
  fetchLedgerEvents: vi.fn().mockResolvedValue([]),
}));

const fetchMock = vi.mocked(api.fetchLifeReading);

/** Synthetic rows (no real person): the server's doc 54 §4 shape. */
const reading: api.LifeReading = {
  built_at: '2026-11-05',
  cached: false,
  rule_now: 'Until 7 Feb 2027, hold off on big decisions that are hard to undo: signing, quitting, buying, ending.',
  areas: [
    {
      id: 'work',
      label: 'Work',
      verdict: 'promised',
      score: 74,
      issue: 'Your current chapter is testing work until 7 Feb 2027. Has work felt harder to move lately?',
      cause: { planets: ['Rahu', 'Saturn'], dashas: ['Vimshottari Moon–Rahu (to 7 Feb 2027)'], text: 'Mostly because the chapter you are in now leans against this part of life.' },
      improves: [{ from: '2027-02-07', to: '2027-09-15', md: 'Moon', ad: 'Saturn', systems: ['Vimshottari', 'Yogini'], grade: 'moderate', basis: 'moderate: two systems agree' }],
      solution: ['Keep a running list of what you delivered.', 'Act between 7 Feb 2027 and 15 Sep 2027: what you prepare now is used then.'],
      grade: 'moderate',
      basis: 'moderate: two systems agree',
    },
    {
      id: 'money',
      label: 'Money',
      verdict: 'partial',
      score: 52,
      issue: 'No sign of pressure on money and savings right now.',
      cause: { planets: [], dashas: [], text: 'Your chart shows steady support here.' },
      improves: [{ from: '2028-03-01', to: '2029-01-10', md: 'Mars', ad: 'Jupiter', systems: ['Vimshottari', 'Narayana', 'Yogini', 'Dwisaptati'], grade: 'strong', basis: 'strong: four systems agree, the year chart confirms' }],
      solution: ['Keep a simple monthly record of what comes in and what goes out.'],
      grade: 'strong',
      basis: 'strong: four systems agree, the year chart confirms',
    },
  ],
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
});

describe('LifeReadingDashboard', () => {
  it('shows loading, then the rule for now and the five-column table', async () => {
    fetchMock.mockResolvedValue({ kind: 'ok', reading });
    render(<LifeReadingDashboard />);
    expect(screen.getByTestId('life-loading')).toBeInTheDocument();
    const dash = await screen.findByTestId('life-dashboard');
    expect(within(dash).getByRole('heading', { name: 'Your life at a glance' })).toBeInTheDocument();
    expect(screen.getByTestId('life-rule-now')).toHaveTextContent('Until 7 Feb 2027, hold off');
    const table = screen.getByTestId('life-table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([...COLUMNS]);
    const row = screen.getByTestId('life-row-work');
    expect(row).toHaveTextContent('Has work felt harder to move lately?');
    expect(row).toHaveTextContent('7 Feb 2027 – 15 Sep 2027');
    expect(within(row).getByTestId('grade-moderate')).toHaveAttribute('title', 'moderate: two systems agree');
    expect(within(screen.getByTestId('life-row-money')).getByTestId('grade-strong')).toHaveTextContent('Strong');
    // chart terms live only inside Chart details
    expect(within(row).getByText('Chart details')).toBeInTheDocument();
    expect(within(row).getByText('Vimshottari Moon–Rahu (to 7 Feb 2027)').closest('details')).not.toBeNull();
  });

  it('renders one swipeable card per area for phones', async () => {
    fetchMock.mockResolvedValue({ kind: 'ok', reading });
    render(<LifeReadingDashboard />);
    const cards = await screen.findByTestId('life-cards');
    expect(within(cards).getAllByRole('article')).toHaveLength(2);
    expect(within(screen.getByTestId('life-card-money')).getByText('1 Mar 2028 – 10 Jan 2029')).toBeInTheDocument();
    const dots = within(cards).getAllByRole('tab');
    expect(dots).toHaveLength(2);
    await userEvent.click(dots[1]);
    expect(dots[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('says it is preparing, and checks again on request', async () => {
    fetchMock.mockResolvedValueOnce({ kind: 'preparing' }).mockResolvedValueOnce({ kind: 'ok', reading });
    render(<LifeReadingDashboard />);
    expect(await screen.findByTestId('life-preparing')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(await screen.findByTestId('life-dashboard')).toBeInTheDocument();
  });

  it('asks for birth details without a chart', async () => {
    fetchMock.mockResolvedValue({ kind: 'no_kundli' });
    render(<LifeReadingDashboard />);
    expect(await screen.findByTestId('life-no-kundli')).toHaveTextContent('Add your birth date, time and place');
  });

  it('shows an error with retry', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ kind: 'ok', reading });
    render(<LifeReadingDashboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this right now.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('life-dashboard')).toBeInTheDocument();
  });

  it('renders nothing when the feature is off on the server', async () => {
    fetchMock.mockResolvedValue({ kind: 'unavailable' });
    const { container } = render(<LifeReadingDashboard />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe('Profile → Timeline', () => {
  it('puts the card above the past-life reading when the timeline flag is on', async () => {
    vi.stubEnv('VITE_TIMELINE_ENABLED', 'true');
    fetchMock.mockResolvedValue({ kind: 'ok', reading });
    render(
      <MemoryRouter>
        <ProfileTimeline />
      </MemoryRouter>,
    );
    const dash = await screen.findByTestId('life-dashboard');
    const past = await screen.findByLabelText('Comprehensive 18-Year Past Life Reading');
    expect(dash.compareDocumentPosition(past) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the card alone with VITE_LIFE_READING_ENABLED=1', async () => {
    vi.stubEnv('VITE_TIMELINE_ENABLED', 'false');
    vi.stubEnv('VITE_LIFE_READING_ENABLED', '1');
    fetchMock.mockResolvedValue({ kind: 'no_kundli' });
    render(
      <MemoryRouter>
        <ProfileTimeline />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('life-no-kundli')).toBeInTheDocument();
    expect(screen.queryByLabelText('Comprehensive 18-Year Past Life Reading')).toBeNull();
  });

  it('does not show the card with both flags off', () => {
    vi.stubEnv('VITE_TIMELINE_ENABLED', 'false');
    render(
      <MemoryRouter>
        <ProfileTimeline />
      </MemoryRouter>,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
