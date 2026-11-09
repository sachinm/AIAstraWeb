import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SelfReading, { certaintyWord, clockLabel, headerWords, SELF_WORDS } from './SelfReading';
import { LINE_MS, ORACLE_LINES } from './OracleWait';
import { BODY_NOTE, selfReadingFixture } from './selfReading.fixture';
import { BANNED_ON_BOARD } from '../lucky/words';
import { longDate } from '../../lib/careerApi';
import type { SelfReading as SelfReadingData } from '../../lib/selfReadingApi';

/** doc 61 §4: the body list joins the board's banned words */
const BODY_BANNED = ['illness', 'disease', 'diagnosis', 'symptom', 'medication', 'surgery', 'doctor', 'liver', 'heart', 'lung', 'kidney', 'stomach', 'brain'];
const BANNED = [...BANNED_ON_BOARD, 'house', 'lord', 'dasha', 'mahadasha', 'antardasha', 'nakshatra', 'varga', 'd1.', 'd9.', ...BODY_BANNED];
const TITLES = ['In short', 'Your chapters', 'Who you are', 'Your mind', 'Your body', "Your soul's aim", 'Gifts and knots', 'What you struggle with', 'This year'];

let srv: { status: number; body: unknown; clock: string; edit: (r: SelfReadingData) => void };
let calls: Array<{ method: string; url: string; body?: any }>;

beforeEach(() => {
  localStorage.setItem('token', 't');
  calls = [];
  srv = { status: 200, body: null, clock: 'dwisatpathi', edit: () => {} };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith('/api/self/reading') && method === 'GET') {
        if (srv.status !== 200) return new Response(JSON.stringify(srv.body ?? { error: 'x' }), { status: srv.status });
        const reading = selfReadingFixture(srv.clock);
        srv.edit(reading);
        return new Response(JSON.stringify({ status: 'ok', built_at: '2026-11-07', cached: true, reading }), { status: 200 });
      }
      if (url.endsWith('/api/self/reading/confirm')) return new Response(null, { status: 204 });
      if (url.endsWith('/api/self/clock')) {
        srv.clock = body.system ?? 'dwisatpathi';
        return new Response(JSON.stringify({ clock: srv.clock }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

const gets = () => calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/self/reading')).length;

describe('Your reading', () => {
  it('shows "Reading your chart…" while loading', () => {
    render(<SelfReading />);
    expect(screen.getByTestId('self-reading-loading')).toHaveTextContent(SELF_WORDS.loading);
  });

  it('preparing: says so and polls every 30 s until the reading is ready', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    srv.status = 202;
    srv.body = { status: 'preparing' };
    render(<SelfReading />);
    expect(await screen.findByTestId('self-reading-preparing')).toHaveTextContent('Your chart is still being prepared. This page will update by itself.');
    expect(gets()).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => expect(gets()).toBe(2));
    expect(screen.getByTestId('self-reading-preparing')).toBeInTheDocument();
    srv.status = 200;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(await screen.findByTestId('self-reading')).toBeInTheDocument();
    expect(gets()).toBe(3);
  });

  it('no kundli and off', async () => {
    srv.status = 404;
    srv.body = { status: 'no_kundli' };
    const a = render(<SelfReading />);
    expect(await screen.findByTestId('self-reading-no-kundli')).toBeInTheDocument();
    a.unmount();
    srv.body = { error: 'not_found' };
    render(<SelfReading />);
    expect(await screen.findByTestId('self-reading-unavailable')).toBeInTheDocument();
  });

  it('renders the clock line, every panel title, chips and the desktop tab list, and never the gaps', async () => {
    render(<SelfReading />);
    const root = await screen.findByTestId('self-reading');
    expect(screen.getByTestId('self-clock-line')).toHaveTextContent('Read on your Dwisaptati Sama clock · Change');
    expect(within(screen.getByTestId('self-chips')).getAllByRole('tab').map((t) => t.textContent)).toEqual(TITLES);
    expect(within(screen.getByTestId('self-tabs')).getAllByRole('tab').map((t) => t.textContent)).toEqual(TITLES);
    const carousel = screen.getByTestId('self-carousel');
    for (const t of TITLES) expect(within(carousel).getByRole('heading', { name: t })).toBeInTheDocument();
    // desktop shows the first panel, and a tab switches it
    expect(within(screen.getByTestId('self-tabpanel')).getByRole('heading')).toHaveTextContent('In short');
    fireEvent.click(within(screen.getByTestId('self-tabs')).getByRole('tab', { name: 'Your mind' }));
    expect(within(screen.getByTestId('self-tabpanel')).getByRole('heading')).toHaveTextContent('Your mind');
    expect(root.textContent).not.toContain('STAFF-GAP');
    expect(root.textContent).not.toContain('varsha_missing_point');
  });

  it('panels follow the order the server sends', async () => {
    srv.edit = (r) => {
      r.panels.reverse();
    };
    render(<SelfReading />);
    await screen.findByTestId('self-reading');
    expect(within(screen.getByTestId('self-chips')).getAllByRole('tab').map((t) => t.textContent)).toEqual([...TITLES].reverse());
  });

  it('card header words for each range kind: True until, This year, Always, and a range that starts later', async () => {
    render(<SelfReading />);
    const carousel = await screen.findByTestId('self-carousel');
    const head = (id: string) => within(within(carousel).getByTestId(`self-panel-${id}`)).getByTestId('self-panel-range').textContent;
    expect(head('diagnosis')).toBe('True until 14 May 2027');
    expect(head('body')).toBe('True until 14 May 2027');
    expect(head('struggle')).toBe('True until 14 May 2027');
    expect(head('chapters')).toBe('True until 16 Feb 2028');
    expect(head('year')).toBe(`This year: ${longDate('2026-09-09')} – ${longDate('2027-09-09')}`);
    for (const id of ['lagna', 'mind', 'atma', 'yogas']) expect(head(id)).toBe('Always');
    expect(headerWords('struggle', { from: '2027-01-01', to: '2027-06-01' }, '2026-11-07')).toBe('True from 1 Jan 2027 to 1 Jun 2027');
  });

  it('lines are the card body; a line shows its own range only when it differs from the header', async () => {
    render(<SelfReading />);
    const carousel = await screen.findByTestId('self-carousel');
    const chapters = within(carousel).getByTestId('self-panel-chapters');
    // the lines sit above the chapter cards
    const lines = within(chapters).getByTestId('self-lines');
    expect(lines.compareDocumentPosition(within(chapters).getByTestId('self-chapters')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(lines).getAllByRole('listitem')).toHaveLength(3);
    const l1 = within(chapters).getByTestId('self-line-chapters.1');
    expect(within(l1).getByTestId('self-line-range')).toHaveTextContent('16 Feb 2010 – 16 Feb 2019');
    expect(within(chapters).getByTestId('self-line-chapters.3')).toHaveTextContent('2 Mar 2026 – 14 May 2027');
    // the running line has the header's range, so no range of its own
    expect(within(within(chapters).getByTestId('self-line-chapters.2')).queryByTestId('self-line-range')).not.toBeInTheDocument();
    // the lead and the claims are not the card body
    const lagna = within(carousel).getByTestId('self-panel-lagna');
    expect(lagna).not.toHaveTextContent('You are built to lead from the front and be seen doing it.');
    expect(lagna).toHaveTextContent('Your sense of self grows through your work and public role.');
    expect(within(lagna).queryByTestId('self-line-range')).not.toBeInTheDocument();
    // an "Always" line on a dated card says so
    const body = within(carousel).getByTestId('self-panel-body');
    expect(within(within(body).getByTestId('self-line-body.1')).getByTestId('self-line-range')).toHaveTextContent('Always');
  });

  it('the body panel carries its standing note under the title', async () => {
    render(<SelfReading />);
    const body = within(await screen.findByTestId('self-carousel')).getByTestId('self-panel-body');
    expect(within(body).getByRole('heading')).toHaveTextContent('Your body');
    expect(within(body).getByTestId('self-panel-note')).toHaveTextContent(BODY_NOTE);
    expect(within(body).getAllByRole('listitem')).toHaveLength(3);
  });

  it('certainty words show on timing lines only, never on a fact or an Always line', async () => {
    render(<SelfReading />);
    const carousel = await screen.findByTestId('self-carousel');
    const word = (panel: string, line: string) =>
      within(within(within(carousel).getByTestId(`self-panel-${panel}`)).getByTestId(`self-line-${line}`)).queryByTestId('self-line-certainty')?.textContent ?? null;
    expect(word('diagnosis', 'diagnosis.1')).toBeNull();
    expect(word('diagnosis', 'diagnosis.2')).toBe('Strong');
    expect(word('diagnosis', 'diagnosis.3')).toBe('Likely');
    expect(word('struggle', 'struggle.1')).toBe('Possible');
    expect(word('struggle', 'struggle.2')).toBeNull();
    expect(word('year', 'year.2')).toBe('Possible');
    // 'strong' and 'moderate' on Always lines show no word
    expect(word('mind', 'mind.2')).toBeNull();
    expect(word('body', 'body.3')).toBeNull();
    for (const id of ['lagna', 'atma', 'yogas']) expect(within(within(carousel).getByTestId(`self-panel-${id}`)).queryByTestId('self-line-certainty')).not.toBeInTheDocument();
    expect(certaintyWord({ id: 'x.1', text: '', range: { from: '2026-01-01', to: '2027-01-01' }, claimIds: [], certainty: 'fact', detail: '' })).toBeNull();
  });

  it('chapters: previous, running, next in order, dates, sub-chapter, split text and the confirmation line', async () => {
    render(<SelfReading />);
    const ch = within(await screen.findByTestId('self-carousel')).getByTestId('self-chapters');
    const cards = within(ch).getAllByRole('article');
    expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual(['chapter-previous', 'chapter-running', 'chapter-next']);
    const running = within(ch).getByTestId('chapter-running');
    expect(within(running).getByTestId('chapter-dates-running')).toHaveTextContent('16 Feb 2019 – 16 Feb 2028');
    expect(running).toHaveTextContent('A chapter of ambition and reaching past where you started.');
    expect(within(running).getByTestId('chapter-confirmed-running')).toHaveTextContent('Confirmed by Vimshottari and Chara');
    expect(within(running).getByTestId('chapter-sub')).toHaveTextContent('2 Mar 2026 – 14 May 2027');
    expect(within(running).getByTestId('chapter-sub')).toHaveTextContent('Now the focus turns to partners and comfort.');
    expect(within(running).getByTestId('chapter-next-sub')).toHaveTextContent(`Then: ${longDate('2027-05-14')} – ${longDate('2027-09-20')}`);
    const prev = within(ch).getByTestId('chapter-previous');
    expect(prev).toHaveTextContent('16 Feb 2010 – 16 Feb 2019');
    expect(within(prev).getByTestId('chapter-confirmed-previous')).toHaveTextContent('Confirmed by Vimshottari');
    const next = within(ch).getByTestId('chapter-next');
    expect(next).toHaveTextContent('Your other clocks do not mark a turn here');
    expect(within(next).queryByTestId('chapter-confirmed-next')).not.toBeInTheDocument();
  });

  it('Chart details is off by default and reveals each line\'s detail and claim ids, the technique and the vetoed claims', async () => {
    render(<SelfReading />);
    await screen.findByTestId('self-tabpanel');
    fireEvent.click(within(screen.getByTestId('self-tabs')).getByRole('tab', { name: 'Who you are' }));
    const tp = screen.getByTestId('self-tabpanel');
    expect(within(tp).queryByTestId('self-chart-detail')).not.toBeInTheDocument();
    expect(tp).not.toHaveTextContent('self.reading.lagna');
    expect(tp).not.toHaveTextContent('People notice you before you speak.');
    expect(tp).not.toHaveTextContent('lagna.lord_house');
    const toggle = within(tp).getByRole('button', { name: 'Chart details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const l1 = within(tp).getByTestId('self-line-lagna.1');
    expect(l1).toHaveTextContent('Lagna Leo; lagna lord Su in D1.h10, dignity friendly.');
    expect(l1).toHaveTextContent('lagna.lord_house');
    expect(within(tp).getByTestId('self-line-lagna.2')).toHaveTextContent('lagna.dignity');
    const vetoed = within(tp).getByTestId('self-panel-vetoed');
    expect(vetoed).toHaveTextContent('People notice you before you speak.');
    expect(vetoed).toHaveTextContent('lagna.occupant · purview.combust_occupant');
    expect(within(tp).getByTestId('self-panel-technique')).toHaveTextContent('self.reading.lagna · 0 ms · cached');
    // the purview entry on this panel shows only as an adjustment note
    expect(within(tp).getByTestId('self-panel-adjusted')).toHaveTextContent('Adjusted by a whole-chart check: a claim about how people first see you was removed.');
    expect(tp).not.toHaveTextContent('PURVIEW-');
    fireEvent.click(toggle);
    expect(within(tp).queryByTestId('self-chart-detail')).not.toBeInTheDocument();
    expect(within(tp).queryByTestId('self-panel-vetoed')).not.toBeInTheDocument();
  });

  it('a purview entry appears only inside the affected panel\'s Chart details; purview, audit and dossier are never shown', async () => {
    render(<SelfReading />);
    const root = await screen.findByTestId('self-reading');
    expect(root).not.toHaveTextContent('Adjusted by a whole-chart check');
    expect(root).not.toHaveTextContent('weak-footing');
    expect(root).not.toHaveTextContent('DOSSIER-7f3a');
    fireEvent.click(within(screen.getByTestId('self-tabs')).getByRole('tab', { name: 'Your mind' }));
    fireEvent.click(within(screen.getByTestId('self-tabpanel')).getByRole('button', { name: 'Chart details' }));
    expect(within(screen.getByTestId('self-tabpanel')).queryByTestId('self-panel-adjusted')).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('self-tabs')).getByRole('tab', { name: 'Your body' }));
    const tp = screen.getByTestId('self-tabpanel');
    fireEvent.click(within(tp).getByRole('button', { name: 'Chart details' }));
    expect(within(tp).getByTestId('self-panel-adjusted')).toHaveTextContent('Adjusted by a whole-chart check: the weak-footing line was replaced because a cancellation lifts it.');
    expect(root).not.toHaveTextContent('PURVIEW-');
    expect(root).not.toHaveTextContent('DOSSIER-7f3a');
  });

  it('shows the built line once at the bottom', async () => {
    render(<SelfReading />);
    const root = await screen.findByTestId('self-reading');
    expect(screen.getAllByTestId('self-built-line')).toHaveLength(1);
    expect(screen.getByTestId('self-built-line')).toHaveTextContent('Built 7 Nov 2026, next check 14 May 2027');
    expect(root.lastElementChild).toBe(screen.getByTestId('self-built-line'));
  });

  it('the question posts the answer, says thanks and hides', async () => {
    render(<SelfReading />);
    const q = await screen.findByTestId('self-question');
    expect(q).toHaveTextContent('Do you feel most yourself when you are leading at work?');
    expect(within(q).getAllByRole('button').map((b) => b.textContent)).toEqual(['Yes', 'Partly', 'No', 'Skip']);
    fireEvent.click(within(q).getByRole('button', { name: 'Partly' }));
    expect(await screen.findByTestId('self-question-thanks')).toHaveTextContent('Thanks, noted.');
    expect(screen.queryByTestId('self-question')).not.toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/api/self/reading/confirm'))!;
    expect(post.body).toEqual({ claimId: 'lagna.lord_house', answer: 'partly' });
  });

  it('changing the clock calls PUT then reloads the reading', async () => {
    render(<SelfReading />);
    await screen.findByTestId('self-reading');
    expect(gets()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    const sheet = screen.getByTestId('self-clock-sheet');
    expect(within(sheet).getAllByRole('button', { pressed: true }).map((b) => b.textContent)).toEqual(['Dwisaptati Sama']);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Vimshottari' }));
    await waitFor(() => expect(screen.getByTestId('self-clock-line')).toHaveTextContent('Read on your Vimshottari clock'));
    const put = calls.findIndex((c) => c.method === 'PUT' && c.url.endsWith('/api/self/clock'));
    expect(calls[put]!.body).toEqual({ system: 'vimshottari' });
    expect(gets()).toBe(2);
    expect(calls.slice(put + 1).some((c) => c.method === 'GET' && c.url.endsWith('/api/self/reading'))).toBe(true);
    expect(screen.queryByTestId('self-clock-sheet')).not.toBeInTheDocument();
  });

  it('no banned or chart word in the reading text with Chart details closed (clock and confirmation lines name only clocks)', async () => {
    render(<SelfReading />);
    const root = await screen.findByTestId('self-reading');
    const exempt = [screen.getByTestId('self-clock-label'), ...screen.getAllByTestId(/^chapter-confirmed-/)];
    let body = root.textContent!;
    for (const e of exempt) body = body.split(e.textContent!).join(' ');
    for (const w of BANNED) expect(body.toLowerCase(), w).not.toContain(w);
    for (const e of exempt) for (const w of BANNED_ON_BOARD) expect(e.textContent!.toLowerCase(), w).not.toContain(w);
  });

  it('a clock label never shows the word dasha', () => {
    expect(clockLabel('Vimshottari Dasha')).toBe('Vimshottari');
    expect(clockLabel('Chara dasha')).toBe('Chara');
    expect(clockLabel('Dwisaptati Sama')).toBe('Dwisaptati Sama');
  });

  it('a failed panel says so in plain words', async () => {
    srv.edit = (r) => {
      r.panels.find((p) => p.id === 'mind')!.status = 'failed';
    };
    render(<SelfReading />);
    const mind = within(await screen.findByTestId('self-carousel')).getByTestId('self-panel-mind');
    expect(mind).toHaveTextContent('This part could not be read just now.');
    expect(mind).not.toHaveTextContent('You need quiet to think clearly.');
  });

  it('a panel with no lines shows only its title and the not-enough sentence', async () => {
    srv.edit = (r) => {
      const year = r.panels.find((p) => p.id === 'year')!;
      year.status = 'withheld';
      year.lines = [];
      const body = r.panels.find((p) => p.id === 'body')!;
      body.lines = [];
    };
    render(<SelfReading />);
    const carousel = await screen.findByTestId('self-carousel');
    for (const id of ['year', 'body']) {
      const panel = within(carousel).getByTestId(`self-panel-${id}`);
      expect(panel.textContent).toBe(`${id === 'year' ? 'This year' : 'Your body'}${SELF_WORDS.withheldPanel}`);
      expect(within(panel).queryByRole('button', { name: 'Chart details' })).not.toBeInTheDocument();
      expect(within(panel).queryByTestId('self-panel-range')).not.toBeInTheDocument();
    }
    expect(SELF_WORDS.withheldPanel).toBe('Not enough in your chart to say this with confidence.');
  });
});

describe('Your reading, while the synthesis is written in the background (server doc 64 §4)', () => {
  it('202 stage=reading keeps a loading state with the writing words and polls every 10 s until the reading is ready', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    srv.status = 202;
    srv.body = { status: 'preparing', stage: 'reading' };
    render(<SelfReading />);
    const waiting = await screen.findByTestId('self-reading-preparing');
    expect(waiting).toHaveTextContent(SELF_WORDS.writing);
    expect(waiting).toHaveAttribute('data-stage', 'reading');
    expect(waiting).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('self-reading-error')).not.toBeInTheDocument();
    expect(gets()).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    await waitFor(() => expect(gets()).toBe(2));
    srv.status = 200;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(await screen.findByTestId('self-reading')).toBeInTheDocument();
    expect(gets()).toBe(3);
  });

  it('a 503 or 504 from the gateway is the same wait, never "did not load"', async () => {
    srv.status = 503;
    srv.body = { error: 'reading_slow' };
    const a = render(<SelfReading />);
    expect(await screen.findByTestId('self-reading-preparing')).toHaveTextContent(SELF_WORDS.writing);
    a.unmount();
    srv.status = 504;
    srv.body = null;
    render(<SelfReading />);
    expect(await screen.findByTestId('self-reading-preparing')).toHaveTextContent(SELF_WORDS.writing);
    expect(screen.queryByTestId('self-reading-error')).not.toBeInTheDocument();
  });

  it('renders the Oracle plan inside its panel and the full reading under the panels when the synthesis is there', async () => {
    srv.edit = (r) => {
      r.panels[0]!.plan = {
        summary: 'Hold the course this winter and let the partnership question settle before you move.',
        steps: [{ text: 'Write down what you want from the partnership before 1 Jan.', range: { from: '2026-11-07', to: '2027-01-01' }, claimIds: ['diagnosis.tension'] }],
        calendar: [
          { from: '2026-12-24', to: '2026-12-24', label: 'The year clock changes hands', claimIds: [], inWindow: true },
          { from: '2027-01-01', to: '2027-01-01', label: 'Pressure lifts', claimIds: [], inWindow: false },
        ],
      };
      r.oracle = { status: 'ok', text: '### In short\n\nYou are built to be seen through the people you serve.\n\nThe pressure of this stretch eases from January.' };
    };
    render(<SelfReading />);
    await screen.findByTestId('self-reading');
    const panel = within(screen.getByTestId('self-tabpanel')).getByTestId('self-panel-diagnosis');
    const plan = within(panel).getByTestId('self-panel-plan');
    expect(within(plan).getByTestId('self-plan-summary')).toHaveTextContent('Hold the course this winter');
    expect(within(plan).getByTestId('self-plan-steps')).toHaveTextContent(`${longDate('2026-11-07')} – ${longDate('2027-01-01')} · Write down what you want`);
    expect(within(plan).getByTestId('self-plan-calendar')).toHaveTextContent(`${longDate('2026-12-24')} · The year clock changes hands`);
    const full = screen.getByTestId('self-full-reading');
    expect(within(full).getByRole('heading')).toHaveTextContent(SELF_WORDS.fullReading);
    expect(within(full).getAllByText(/./, { selector: 'p' }).map((p) => p.textContent)).toEqual([
      'In short',
      'You are built to be seen through the people you serve.',
      'The pressure of this stretch eases from January.',
    ]);
  });

  it('shows nothing of the Oracle when it failed: the code panels stand alone', async () => {
    srv.edit = (r) => {
      r.oracle = { status: 'failed' };
    };
    render(<SelfReading />);
    await screen.findByTestId('self-reading');
    expect(screen.queryByTestId('self-full-reading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('self-panel-plan')).not.toBeInTheDocument();
  });
});

describe('Your reading, the code panels under the Oracle veil while the synthesis is written (server doc 64 §4)', () => {
  it('shows every panel at once with a rotating Oracle line and a veil per panel, polls every 10 s, and lifts the veils when the synthesis lands', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let pending = true;
    srv.edit = (r) => {
      r.oracle = pending ? { status: 'pending' } : { status: 'ok', text: 'In short: built on partnership.' };
    };
    render(<SelfReading />);
    expect(await screen.findByTestId('self-reading')).toBeInTheDocument();
    const note = screen.getByTestId('self-oracle-waiting');
    expect(ORACLE_LINES).toContain(note.textContent);
    const veil = within(screen.getByTestId('self-tabpanel')).getByTestId('oracle-veil-diagnosis');
    expect(veil).toHaveAttribute('data-waiting', 'true');
    expect(within(veil).getByTestId('oracle-veil-note-diagnosis').textContent).toMatch(/\S/);
    // every carousel panel is veiled too, each starting on its own line
    expect(screen.getByTestId('self-carousel').querySelectorAll('[data-waiting="true"]')).toHaveLength(9);
    // the line moves on
    const first = note.textContent;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LINE_MS);
    });
    expect(screen.getByTestId('self-oracle-waiting').textContent).not.toBe(first);
    expect(gets()).toBe(1);
    pending = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    await waitFor(() => expect(gets()).toBe(2));
    await waitFor(() => expect(screen.queryByTestId('self-oracle-waiting')).not.toBeInTheDocument());
    expect(within(screen.getByTestId('self-tabpanel')).getByTestId('oracle-veil-diagnosis')).toHaveAttribute('data-waiting', 'false');
    expect(screen.getByTestId('self-full-reading')).toHaveTextContent('built on partnership');
  });
});
