import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LedgerSection from './LedgerSection';
import { resetLedgerMetaCache } from './useLedgerMeta';
import * as api from '../../lib/ledgerApi';
import type { LedgerMeta, LifeEvent } from '../../lib/ledgerApi';

vi.mock('../../lib/ledgerApi', async (orig) => {
  const real = await orig<typeof import('../../lib/ledgerApi')>();
  return {
    ...real,
    fetchLedgerMeta: vi.fn(),
    fetchLedgerEvents: vi.fn(),
    createLedgerEvent: vi.fn(),
    updateLedgerEvent: vi.fn(),
    deleteLedgerEvent: vi.fn(),
    runLedgerInterview: vi.fn(),
  };
});

const meta: LedgerMeta = {
  markers: [
    { id: 'work', label: 'Work', categories: [{ code: 'job_change', label: 'Job change' }] },
    { id: 'home', label: 'Home', categories: [{ code: 'relocation', label: 'Relocation' }] },
  ],
  attributes: [
    { key: 'direction', label: 'Direction', values: ['north', 'south', 'east', 'west'] },
    { key: 'role', label: 'Role' },
  ],
  precisions: ['day', 'month', 'year'],
  years: 18,
  interview: true,
};

const thisYear = new Date().getFullYear();
const events: LifeEvent[] = [
  { id: 'e1', category: 'relocation', date: `${thisYear - 2}-03-01`, date_precision: 'month', place: 'Pune', attributes: { direction: 'south' } },
  { id: 'e2', category: 'job_change', date: `${thisYear - 1}-01-01`, date_precision: 'year', place: null, attributes: {} },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/timeline/ledger']}>
      <Routes>
        <Route path="/dashboard/timeline/ledger" element={<LedgerSection />} />
        <Route path="/dashboard/chat" element={<div>chat page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const JUDGEMENT = /\b(good|bad|lucky|unlucky|success|successful|failure|positive|negative|auspicious|inauspicious)\b/i;

describe('LedgerSection', () => {
  beforeEach(() => {
    resetLedgerMetaCache();
    vi.mocked(api.fetchLedgerMeta).mockReset().mockResolvedValue(meta);
    vi.mocked(api.fetchLedgerEvents).mockReset().mockResolvedValue(events);
    vi.mocked(api.createLedgerEvent).mockReset();
    vi.mocked(api.runLedgerInterview).mockReset();
  });

  it('redirects away when the feature is off (meta 404 -> null)', async () => {
    vi.mocked(api.fetchLedgerMeta).mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText('chat page')).toBeInTheDocument();
  });

  it('shows 18 year columns, events in their year, and no judgement wording', async () => {
    renderPage();
    const strip = await screen.findByRole('region', { name: 'Year strip' });
    const cols = within(strip).getAllByRole('listitem');
    expect(cols).toHaveLength(18);
    expect(cols[0]).toHaveAttribute('data-year', String(thisYear - 17));
    expect(cols[17]).toHaveAttribute('data-year', String(thisYear));
    const col = strip.querySelector(`[data-year="${thisYear - 2}"]`) as HTMLElement;
    expect(within(col).getByRole('button', { name: /Relocation/ })).toHaveTextContent('Mar');
    const wholeCol = strip.querySelector(`[data-year="${thisYear - 1}"]`) as HTMLElement;
    expect(within(within(wholeCol).getByLabelText('Whole year')).getByRole('button', { name: /Job change/ })).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(JUDGEMENT);
  });

  it('groups categories by marker and switches the date input with precision', async () => {
    const user = userEvent.setup();
    renderPage();
    const select = await screen.findByLabelText('Category');
    expect(select.querySelectorAll('optgroup')).toHaveLength(2);
    expect(screen.getByLabelText('Date')).toHaveAttribute('type', 'date');
    await user.selectOptions(screen.getByLabelText('How exact is the date?'), 'month');
    expect(screen.getByLabelText('Month')).toHaveAttribute('type', 'month');
    await user.selectOptions(screen.getByLabelText('How exact is the date?'), 'year');
    expect(screen.getByLabelText('Year')).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('Direction (optional)').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Role (optional)')).toHaveAttribute('maxLength', '80');
  });

  it('shows a server 400 next to the field it names', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createLedgerEvent).mockRejectedValue(new api.LedgerApiError(400, 'place_wording', 'place'));
    renderPage();
    await user.selectOptions(await screen.findByLabelText('Category'), 'relocation');
    await user.selectOptions(screen.getByLabelText('How exact is the date?'), 'year');
    await user.type(screen.getByLabelText('Year'), '2015');
    await user.type(screen.getByLabelText('Place (optional)'), 'somewhere');
    await user.click(screen.getByRole('button', { name: 'Add event' }));
    expect(api.createLedgerEvent).toHaveBeenCalledWith({
      category: 'relocation',
      date: '2015',
      date_precision: 'year',
      place: 'somewhere',
      attributes: {},
    });
    const err = await screen.findByText('Place wording.');
    expect(screen.getByLabelText('Place (optional)')).toHaveAttribute('aria-describedby', err.id);
  });

  it('clicking a strip event opens it in the edit form', async () => {
    const user = userEvent.setup();
    renderPage();
    const strip = await screen.findByRole('region', { name: 'Year strip' });
    await user.click(within(strip).getByRole('button', { name: /Relocation/ }));
    expect(screen.getByRole('heading', { name: 'Edit event' })).toBeInTheDocument();
    expect(screen.getByLabelText('Month')).toHaveValue(`${thisYear - 2}-03`);
    expect(screen.getByLabelText('Place (optional)')).toHaveValue('Pune');
    expect(screen.getByLabelText('Direction (optional)')).toHaveValue('south');
  });

  it('shows the declined reply as-is and no proposals', async () => {
    const user = userEvent.setup();
    vi.mocked(api.runLedgerInterview).mockResolvedValue({ proposals: [], declined: { reply: 'That is not something I can note here.' } });
    renderPage();
    await user.type(await screen.findByPlaceholderText(/Tell me what happened in a year/), 'text');
    await user.click(screen.getByRole('button', { name: 'Find events' }));
    expect(await screen.findByTestId('interview-reply')).toHaveTextContent('That is not something I can note here.');
    expect(screen.queryByRole('heading', { name: 'Proposed event' })).not.toBeInTheDocument();
  });

  it('confirms proposals one by one, with skip', async () => {
    const user = userEvent.setup();
    vi.mocked(api.runLedgerInterview).mockResolvedValue({
      proposals: [
        { proposalId: 'p1', category: 'relocation', date: '2014-06-01', date_precision: 'month', place: 'Pune', attributes: {} },
        { proposalId: 'p2', category: 'job_change', date: '2014-01-01', date_precision: 'year', place: null, attributes: {} },
      ],
    });
    vi.mocked(api.createLedgerEvent).mockImplementation(async (input) => ({
      id: 'new1',
      category: input.category,
      date: '2014-06-01',
      date_precision: input.date_precision,
      place: input.place ?? null,
      attributes: input.attributes ?? {},
    }));
    renderPage();
    await user.type(await screen.findByPlaceholderText(/Tell me what happened in a year/), 'We moved to Pune in June');
    await user.type(screen.getByLabelText('Year (optional)'), '2014');
    await user.click(screen.getByRole('button', { name: 'Find events' }));
    expect(api.runLedgerInterview).toHaveBeenCalledWith('We moved to Pune in June', 2014);

    const proposal = await screen.findByRole('form', { name: 'Proposed event' });
    expect(screen.getByText(/Proposed event 1 of 2/)).toBeInTheDocument();
    expect(within(proposal).getByLabelText('Month')).toHaveValue('2014-06');
    await user.click(within(proposal).getByRole('button', { name: 'Confirm' }));
    expect(api.createLedgerEvent).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'relocation', date: '2014-06', date_precision: 'month', place: 'Pune' })
    );

    expect(await screen.findByText(/Proposed event 2 of 2/)).toBeInTheDocument();
    await user.click(within(screen.getByRole('form', { name: 'Proposed event' })).getByRole('button', { name: 'Skip' }));
    expect(api.createLedgerEvent).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Proposed event' })).not.toBeInTheDocument());
    expect(screen.getByText(/All proposed events have been gone through/)).toBeInTheDocument();
  });
});
