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

  it('renders the long-term life charter, area charters, bridge, and sub-period timeline with chart terms isolated inside details', async () => {
    const charter: api.LifeMahadashaCharter = {
      from: '2027-09-15',
      to: '2043-09-15',
      remaining_years: 16,
      total_years: 16,
      is_current: false,
      headline: 'A sixteen-year chapter built around steady leadership, property, and earned authority.',
      charter_summary: 'This chapter rewards long-horizon commitments in work and savings while asking for patience at home.',
      area_charters: [
        {
          id: 'work',
          label: 'Work',
          role: 'anchor',
          verdict: 'promised',
          theme: 'Stepping into senior responsibility with lasting institutional backing.',
          promise_note: 'Strong career foundation that compounds when you build repeatable systems.',
          peak_from: '2028-03-01',
          peak_to: '2030-11-12',
          watch_from: '2031-01-01',
          watch_to: '2032-04-15',
          guidance: 'Accept roles with clear mandate and measurable outcomes.',
          grade: 'strong',
          basis: 'strong: four systems agree, the year chart confirms',
          evidence: {
            houses: [10, 1],
            vargas: ['D1', 'D9', 'D10'],
            planets: ['Jupiter', 'Sun'],
            yogas: ['Gajakesari', 'Dharma-Karmadhipati'],
          },
        },
        {
          id: 'money',
          label: 'Money',
          role: 'growth',
          verdict: 'partial',
          theme: 'Gradual compounding through disciplined allocation.',
          promise_note: 'Steady inflows grow once fixed overhead is capped.',
          peak_from: '2029-05-01',
          peak_to: '2031-08-20',
          watch_from: null,
          watch_to: null,
          guidance: 'Automate savings before lifestyle expansion.',
          grade: 'moderate',
          basis: 'moderate: two systems agree',
          evidence: {
            houses: [2, 11],
            vargas: ['D1', 'D2'],
            planets: ['Mercury'],
            yogas: ['Dhana'],
          },
        },
        {
          id: 'home',
          label: 'Home',
          role: 'guarded',
          verdict: 'not_written',
          theme: 'Keep property moves simple and well-inspected.',
          promise_note: 'Needs extra diligence on paperwork and timing.',
          peak_from: null,
          peak_to: null,
          watch_from: '2027-09-15',
          watch_to: '2028-12-01',
          guidance: 'Rent or wait until the watch window clears before major renovations.',
          grade: 'weak',
          basis: 'weak: one system points here',
          evidence: {
            houses: [4],
            vargas: ['D4'],
            planets: ['Saturn', 'Ketu'],
            yogas: [],
          },
        },
      ],
      bridge: {
        from: '2026-11-05',
        to: '2027-09-15',
        remaining_years: 0.9,
        summary: 'Finish open commitments and tidy up handoffs before the new sixteen-year chapter begins.',
        antardashas: [
          {
            from: '2026-11-05',
            to: '2027-09-15',
            is_current: true,
            tone: 'careful',
            headline: 'Tie up loose ends and keep reserves liquid.',
            areas: [
              {
                id: 'work',
                label: 'Work',
                verdict: 'promised',
                summary: 'Complete existing deliverables without over-promising on new tracks.',
                timing: 'Through 15 Sep 2027',
                action: 'Document your wins and close pending reviews.',
              },
            ],
            grade: 'moderate',
            basis: 'moderate: two systems agree',
            evidence: {
              md: 'Mars',
              ad: 'Mercury',
              house_from_md: 6,
              fruition_class: 'Dusthana-6',
              links: ['Rashi-Tulya'],
              systems: ['Vimshottari', 'Yogini'],
              annual_years: ['2026', '2027'],
              transit_houses: [6, 10],
            },
          },
        ],
      },
      antardashas: [
        {
          from: '2027-09-15',
          to: '2029-11-03',
          is_current: true,
          tone: 'breakthrough',
          headline: 'Opening window that sets the tone and opens doors in work.',
          areas: [
            {
              id: 'work',
              label: 'Work',
              verdict: 'promised',
              summary: 'New scope and visibility open up.',
              timing: 'Peak momentum from 1 Mar 2028',
              action: 'Step forward for the lead role you have prepared for.',
            },
          ],
          grade: 'strong',
          basis: 'strong: three systems agree',
          evidence: {
            md: 'Jupiter',
            ad: 'Jupiter',
            house_from_md: 1,
            fruition_class: 'Kendra-Trikona',
            links: ['Swa-Bhukti', 'Paka-Lagna'],
            systems: ['Vimshottari', 'Narayana', 'Dwisaptati'],
            annual_years: ['2027', '2028', '2029'],
            transit_houses: [1, 10],
          },
        },
        {
          from: '2029-11-03',
          to: '2032-05-15',
          is_current: false,
          tone: 'steady_work',
          headline: 'Consolidate gains through disciplined daily execution.',
          areas: [
            {
              id: 'money',
              label: 'Money',
              verdict: 'partial',
              summary: 'Regular cashflow strengthens with structured budgets.',
              timing: 'Steady across 2030–2031',
              action: 'Lock in long-term savings rates.',
            },
          ],
          grade: 'moderate',
          basis: 'moderate: two systems agree',
          evidence: {
            md: 'Jupiter',
            ad: 'Saturn',
            house_from_md: 2,
            fruition_class: 'Dhana-2',
            links: ['Savayava'],
            systems: ['Vimshottari', 'Yogini'],
            annual_years: ['2030', '2031'],
            transit_houses: [2, 11],
          },
        },
      ],
      evidence: {
        md: 'Jupiter',
        own_houses: [9, 12],
        placed_house: 10,
        dispositor: 'Sun',
        star_lord: 'Ketu',
        avastha: 'Deepta',
      },
    };

    fetchMock.mockResolvedValue({ kind: 'ok', reading: { ...reading, charter } });
    render(<LifeReadingDashboard />);

    const charterEl = await screen.findByTestId('life-charter');
    const headerEl = within(charterEl).getByTestId('life-charter-header');
    expect(within(headerEl).getByRole('heading', { name: 'Your long-term life charter' })).toBeInTheDocument();
    expect(headerEl).toHaveTextContent('15 Sep 2027 – 15 Sep 2043 · 16 yrs');
    expect(headerEl).toHaveTextContent('Upcoming major chapter');
    expect(headerEl).toHaveTextContent(charter.headline);
    expect(headerEl).toHaveTextContent(charter.charter_summary);

    // Area charters
    const areasEl = within(charterEl).getByTestId('life-charter-areas');
    const workArea = within(areasEl).getByTestId('life-charter-area-work');
    expect(workArea).toHaveTextContent('Core promise');
    expect(workArea).toHaveTextContent('1 Mar 2028 – 12 Nov 2030');
    expect(workArea).toHaveTextContent('1 Jan 2031 – 15 Apr 2032');
    expect(workArea).toHaveTextContent('Accept roles with clear mandate and measurable outcomes.');

    const moneyArea = within(areasEl).getByTestId('life-charter-area-money');
    expect(moneyArea).toHaveTextContent('Growth area');

    const homeArea = within(areasEl).getByTestId('life-charter-area-home');
    expect(homeArea).toHaveTextContent('Guard carefully');

    // Bridge
    const bridgeEl = within(charterEl).getByTestId('life-charter-bridge');
    expect(bridgeEl).toHaveTextContent('Closing your current chapter (5 Nov 2026 – 15 Sep 2027)');
    expect(bridgeEl).toHaveTextContent(charter.bridge!.summary);

    // Antardasha timeline
    const timelineEl = within(charterEl).getByTestId('life-charter-timeline');
    expect(within(timelineEl).getByRole('heading', { name: 'Sub-periods across this chapter' })).toBeInTheDocument();
    const ads = within(timelineEl).getAllByTestId('life-charter-ad');
    expect(ads).toHaveLength(2);
    expect(ads[0]).toHaveTextContent('15 Sep 2027 – 3 Nov 2029');
    expect(ads[0]).toHaveTextContent('Current period');
    expect(ads[0]).toHaveTextContent('Breakthrough window');
    expect(ads[0]).toHaveTextContent('Step forward for the lead role you have prepared for.');
    expect(ads[1]).toHaveTextContent('Steady effort');

    // Verify chart evidence lives inside <details> and ZERO planet/chart jargon appears outside <details>
    expect(within(headerEl).getByText(/Mahadasha: Jupiter/).closest('details')).not.toBeNull();
    expect(within(headerEl).getByText(/Avastha: Deepta/).closest('details')).not.toBeNull();
    expect(within(workArea).getByText(/Gajakesari/).closest('details')).not.toBeNull();
    expect(within(ads[0]).getByText(/Kendra-Trikona/).closest('details')).not.toBeNull();

    const clone = charterEl.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('details').forEach((d) => d.remove());
    const visibleText = clone.textContent ?? '';
    const forbiddenTerms = [
      'Jupiter',
      'Saturn',
      'Mercury',
      'Mars',
      'Ketu',
      'Rahu',
      'Deepta',
      'Gajakesari',
      'Dharma-Karmadhipati',
      'Kendra-Trikona',
      'Vimshottari',
      'Narayana',
      'Dwisaptati',
      'Yogini',
      'D9',
      'D10',
    ];
    for (const term of forbiddenTerms) {
      expect(visibleText).not.toContain(term);
    }
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
