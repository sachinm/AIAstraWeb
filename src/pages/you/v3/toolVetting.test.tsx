import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CARD_TOOLS, COLD_BOARD_DEFAULTS, type CardOptions } from '../../../lib/cardOptions';
import type { SelfV2Area } from '../../../lib/selfV2Api';
import type { SelfV3CardView } from '../../../lib/selfV3Api';
import { clearSelfV3Cached } from '../../../lib/selfV3Cache';
import { ChartDetails } from '../v2/AreaCard';
import { cardNow } from './boardOptions';
import { periodsOf } from './cardModel';
import CompactCard from './CompactCard';
import SeasonsCard from './SeasonsCard';
import { selfV3Fixture } from './selfV3.fixture';
import { coveringPeriodForDay, formatDisplayDate, scrubEmptyRefs, vetCardTools, vettedTimeframeGroupBys } from './toolVetting';

beforeEach(() => {
  clearSelfV3Cached();
  sessionStorage.clear();
});

function fixtureCard(id: SelfV3CardView['id']): SelfV3CardView {
  const found = selfV3Fixture().cards.find((c) => c.id === id);
  if (!found) throw new Error(`Missing card ${id}`);
  return structuredClone(found);
}

describe('scrubEmptyRefs & formatDisplayDate', () => {
  it('strips empty parenthetical artifacts and dangling commas from redacted text', () => {
    expect(scrubEmptyRefs('Two rows () press on effort (, ) until 12 Dec (, ,).')).toBe('Two rows press on effort until 12 Dec.');
    expect(scrubEmptyRefs('Drive (Mars ()) and work (Amatyakaraka, ) hold steady (; ).')).toBe('Drive (Mars) and work (Amatyakaraka) hold steady.');
    expect(scrubEmptyRefs('')).toBe('');
  });

  it('renders required ChartDetails cleanly without empty parentheticals', () => {
    const area: SelfV2Area = {
      id: 'body',
      group: 'you',
      title: 'Body & energy',
      status: 'ok',
      card: null,
      floor: [],
      details: {
        headline: 'Body & energy (): chart reasons (,)',
        paragraphs: ['Stored period (Mars ()) presses on rest (, ,) until 5 Dec 2026 (;).'],
        evidence: ['row.1'],
        certainty: 'strong',
      },
    };
    render(<ChartDetails details={area.details} />);
    const details = screen.getByTestId('area-details');
    expect(details).toHaveTextContent('Body & energy: chart reasons');
    expect(details).toHaveTextContent('Stored period (Mars) presses on rest until 5 Dec 2026.');
    expect(details.textContent).not.toMatch(/\(\s*[,;]*\s*\)/);
  });

  it('formats ISO dates and timestamps into plain calendar words', () => {
    expect(formatDisplayDate('2026-11-09')).toBe('9 Nov 2026');
    expect(formatDisplayDate('2026-11-09T08:00:00Z')).toBe('9 Nov 2026');
    expect(formatDisplayDate('Already plain')).toBe('Already plain');
  });
});

describe('vetCardTools: strict per-card gating', () => {
  it('vets table, calendar, dates, timeframe and plan on a full v3 card with a ladder (body), while hiding info by default', () => {
    const card = fixtureCard('body');
    const res = vetCardTools({
      card,
      periods: periodsOf(card, '2026-11-14'),
      options: COLD_BOARD_DEFAULTS,
      confirmOn: true,
      builtOn: '2026-11-09',
      today: '2026-11-14',
    });
    expect(res.requiredControls.chartDetails).toBe(true);
    expect(res.availableTools).toEqual(['table', 'calendar', 'dates', 'timeframe', 'plan']);
    expect(res.audit.info.vetted).toBe(false);
  });

  it('suppresses plan on a v3 card that has no ladder (mind)', () => {
    const card = fixtureCard('mind');
    const res = vetCardTools({
      card,
      periods: periodsOf(card, '2026-11-14'),
      options: COLD_BOARD_DEFAULTS,
      confirmOn: true,
      builtOn: '2026-11-09',
      today: '2026-11-14',
    });
    expect(res.availableTools).toEqual(['table', 'calendar', 'dates', 'timeframe']);
    expect(res.audit.plan.vetted).toBe(false);
  });

  it('suppresses table, calendar, dates, timeframe and info on a card with < 2 written stretches, keeping only plan', () => {
    const card = fixtureCard('stuck');
    card.rail = [
      { ...card.rail[0]!, text: ['Single written stretch.'] },
      { ...card.rail[1]!, text: null },
    ];
    const res = vetCardTools({
      card,
      periods: periodsOf(card, '2026-11-14'),
      options: { ...COLD_BOARD_DEFAULTS, tools: [...CARD_TOOLS] },
      confirmOn: true,
      builtOn: '2026-11-09',
      today: '2026-11-14',
    });
    expect(res.availableTools).toEqual(['plan']);
    expect(res.openTools).toEqual(['plan']);
    expect(res.audit.table.vetted).toBe(false);
    expect(res.audit.calendar.vetted).toBe(false);
    expect(res.audit.dates.vetted).toBe(false);
    expect(res.audit.timeframe.vetted).toBe(false);
    expect(res.audit.info.vetted).toBe(false);
  });

  it('returns zero optional tools on a single-stretch untoned card without a ladder, while keeping Chart details required', () => {
    const card = fixtureCard('stuck');
    if (card.v2?.card) card.v2.card.ladder = null;
    if (card.v3) card.v3.ladder = null;
    card.rail = card.rail.slice(0, 1);
    const res = vetCardTools({
      card,
      periods: periodsOf(card, '2026-11-14'),
      options: { ...COLD_BOARD_DEFAULTS, tools: [...CARD_TOOLS] },
      confirmOn: true,
      builtOn: '2026-11-09',
      today: '2026-11-14',
    });
    expect(res.availableTools).toEqual([]);
    expect(res.openTools).toEqual([]);
    expect(res.requiredControls.chartDetails).toBe(true);
  });

  it('enables info when confirmOn is false and the card holds an unanswered confirm prompt, or when staleDates exist', () => {
    const card = fixtureCard('body');
    const hiddenConfirm = vetCardTools({
      card,
      periods: periodsOf(card, '2026-11-14'),
      options: COLD_BOARD_DEFAULTS,
      confirmOn: false,
      builtOn: '2026-11-09',
      today: '2026-11-14',
    });
    expect(hiddenConfirm.availableTools).toContain('info');
    expect(hiddenConfirm.info.waitingConfirm?.claimId).toBe('body.c1');
    expect(hiddenConfirm.info.formattedBuiltOn).toBe('9 Nov 2026');

    const staleCard = fixtureCard('stuck');
    staleCard.stale = true;
    staleCard.staleDates = ['2026-11-10'];
    const staleRes = vetCardTools({
      card: staleCard,
      periods: periodsOf(staleCard, '2026-11-14'),
      options: COLD_BOARD_DEFAULTS,
      confirmOn: true,
      builtOn: '2026-11-01',
      today: '2026-11-14',
    });
    expect(staleRes.availableTools).toContain('info');
    expect(staleRes.info.staleNote).toMatch(/passed since it was built/i);
  });

  it('honours server feature grants (feature.periods, feature.key_dates)', () => {
    const card = fixtureCard('body');
    card.features = {
      'feature.periods': { usable: false, locked: true, minPlan: 'plus' },
      'feature.key_dates': { usable: false, locked: true, minPlan: 'plus' },
    };
    const res = vetCardTools({
      card,
      periods: periodsOf(card, '2026-11-14'),
      options: COLD_BOARD_DEFAULTS,
      confirmOn: true,
      builtOn: '2026-11-09',
      today: '2026-11-14',
    });
    expect(res.availableTools).toEqual(['plan']);
  });
});

describe('Chronological honesty in By timeframe', () => {
  it('excludes dishonest "weeks" and single-bucket "decades" on multi-month spans, and auto-resolves default weeks to months', () => {
    const card = fixtureCard('body');
    const periods = periodsOf(card, '2026-11-14');
    expect(vettedTimeframeGroupBys(periods)).toEqual(['months', 'quarters', 'years']);

    const res = vetCardTools({
      card,
      periods,
      options: { tools: ['timeframe'], groupBy: 'weeks' },
      today: '2026-11-14',
    });
    expect(res.timeframe.effectiveGroupBy).toBe('months');
  });

  it('excludes weeks, months and quarters on multi-year chapters while offering years and decades', () => {
    const card = fixtureCard('stuck');
    card.rail = [
      { from: '2018-05-01', to: '2025-05-01', label: '1 May 2018 → 1 May 2025', tone: null, note: 'Foundation chapter', current: false, span: null, text: ['Seven years of groundwork.'] },
      { from: '2025-05-01', to: '2029-09-01', label: '1 May 2025 → 1 Sep 2029', tone: null, note: 'Consolidation chapter', current: true, span: null, text: ['Four years of building authority.'] },
      { from: '2031-01-01', to: '2038-01-01', label: '1 Jan 2031 → 1 Jan 2038', tone: null, note: 'Expansion chapter', current: false, span: null, text: ['Wider reach and teaching.'] },
    ];
    const periods = periodsOf(card, '2026-11-14');
    expect(vettedTimeframeGroupBys(periods)).toEqual(['years', 'decades']);
  });
});

describe('Doc 75 foundation card controls and vetting data models', () => {
  const fx = selfV3Fixture();

  it('omits legacy tool panels on SeasonsCard and CompactCard while keeping the Why button across Read and Short faces', () => {
    const card = fixtureCard('stuck');
    if (card.v2?.card) card.v2.card.ladder = null;
    if (card.v3) card.v3.ladder = null;
    card.rail = card.rail.slice(0, 1);
    const onWhy = vi.fn();
    const opts: CardOptions = { ...cardNow(fx.layout, 'stuck'), tools: [...CARD_TOOLS] };

    const { rerender } = render(<SeasonsCard card={card} options={opts} onOptions={() => {}} onWhy={onWhy} />);
    expect(screen.queryByTestId('tool-switch')).toBeNull();
    expect(screen.queryByTestId('tool-panels')).toBeNull();
    expect(screen.getByTestId('card-why')).toBeVisible();
    // docs/dashboards/12: the three bars replaced the face switch
    expect(screen.getByRole('tablist', { name: 'Card views' })).toBeInTheDocument();

    for (const face of ['light', 'read'] as const) {
      rerender(<SeasonsCard card={card} options={{ ...opts, face }} onOptions={() => {}} onWhy={onWhy} />);
      expect(screen.queryByTestId('tool-switch')).toBeNull();
      expect(screen.getByTestId('card-why')).toBeVisible();
    }

    fireEvent.click(screen.getByTestId('card-why'));
    expect(onWhy).toHaveBeenCalledTimes(1);

    const compact = render(<CompactCard card={card} options={opts} onOptions={() => {}} onWhy={onWhy} />);
    expect(within(compact.container).getByTestId('card-why')).toBeVisible();
    expect(within(compact.container).queryByTestId('tool-switch')).toBeNull();
  });

  it('computes VettedTableData dynamically omitting empty Tone/Step columns and skipping unwritten rows', () => {
    const card = fixtureCard('stuck');
    card.rail = [
      {
        from: '2026-05-05',
        to: '2026-12-12',
        label: '5 May 2026 → 12 Dec 2026',
        tone: null,
        note: 'Money and effort press',
        current: true,
        span: null,
        text: ['Keep fixed commitments lean until mid-December.'],
      },
      {
        from: '2026-12-12',
        to: '2027-06-03',
        label: '12 Dec 2026 → 3 Jun 2027',
        tone: null,
        note: 'The pull eases',
        current: false,
        span: null,
        text: ['Room returns to clear delayed plans.'],
      },
      {
        from: '2027-06-03',
        to: '2027-10-04',
        label: '3 Jun 2027 → 4 Oct 2027',
        tone: null,
        note: 'Unwritten stretch',
        current: false,
        span: null,
        text: null,
      },
    ];
    const res = vetCardTools({
      card,
      periods: periodsOf(card, '2026-11-14'),
      options: { ...COLD_BOARD_DEFAULTS, tools: ['table'] },
      today: '2026-11-14',
    });

    expect(res.audit.table.vetted).toBe(true);
    expect(res.table.showTone).toBe(false);
    expect(res.table.showFocus).toBe(true);
    expect(res.table.showStep).toBe(false);
    expect(res.table.rows).toHaveLength(2);
    expect(res.table.rows.map((r) => r.focus)).toEqual(['Money and effort press', 'The pull eases']);
  });

  it('keeps all calendar months reachable in CSS (no nth-child(n+4) hiding) and resolves nested sub-periods over overarching rails', () => {
    const css = readFileSync(resolve(__dirname, './selfBoardV3.css'), 'utf8');
    expect(css).not.toMatch(/nth-child\s*\(\s*n\s*\+\s*4\s*\)/);

    const chapterCard = fixtureCard('stuck');
    chapterCard.rail = [
      {
        from: '2010-02-15',
        to: '2028-02-16',
        label: 'now → 16 Feb 2028',
        tone: 'heavy',
        note: 'Overarching chapter',
        current: false,
        span: null,
        text: ['Long chapter background.'],
      },
      {
        from: '2025-11-15',
        to: '2027-01-01',
        label: 'now → 1 Jan 2027',
        tone: 'mixed',
        note: 'Current sub-period',
        current: true,
        span: null,
        text: ['Steady work inside the current sub-period.'],
      },
      {
        from: '2026-06-01',
        to: '2027-02-01',
        label: '1 Jun 2026 → 1 Feb 2027',
        tone: 'light',
        note: 'Inner opening',
        current: false,
        span: null,
        text: ['Doors open from June through January.'],
      },
      {
        from: '2027-02-01',
        to: '2028-02-15',
        label: '1 Feb 2027 → 15 Feb 2028',
        tone: 'mixed',
        note: 'Closing sub-period',
        current: false,
        span: null,
        text: ['Consolidate before the chapter turns.'],
      },
    ];

    const periods = periodsOf(chapterCard, '2026-11-14');
    // Nested specificity: inner sub-periods win over the 18-year overarching rail
    expect(coveringPeriodForDay(periods, '2026-11-20')?.index).toBe(2);
    expect(coveringPeriodForDay(periods, '2027-02-10')?.index).toBe(3);

    const res = vetCardTools({
      card: chapterCard,
      periods,
      options: COLD_BOARD_DEFAULTS,
      today: '2026-11-14',
    });
    expect(res.audit.calendar.vetted).toBe(true);
    // The shadowed outer `heavy` rail never paints a single day in Nov 2026..Oct 2027, so `heavy` is NOT falsely shown in activeTones
    expect(res.calendar.activeTones).toEqual(['mixed', 'light']);
  });

  it('rejects uniform single-shade calendars where two adjacent periods share the exact same tone across the entire window', () => {
    const card = fixtureCard('stuck');
    card.rail = [
      { from: '2026-11-01', to: '2027-04-01', label: '1 Nov 2026 → 1 Apr 2027', tone: 'heavy', note: 'First', current: true, span: null, text: ['First heavy stretch.'] },
      { from: '2027-04-01', to: '2027-11-01', label: '1 Apr 2027 → 1 Nov 2027', tone: 'heavy', note: 'Second', current: false, span: null, text: ['Second heavy stretch.'] },
    ];
    const res = vetCardTools({ card, periods: periodsOf(card, '2026-11-14'), options: COLD_BOARD_DEFAULTS, today: '2026-11-14' });
    expect(res.audit.calendar.vetted).toBe(false);
    expect(res.audit.calendar.reason).toMatch(/same shade/i);
  });

  it('respects options.plan === "without" in vetCardTools', () => {
    const card = fixtureCard('body');
    const offRes = vetCardTools({
      card,
      periods: periodsOf(card, '2026-11-14'),
      options: { ...COLD_BOARD_DEFAULTS, plan: 'without', tools: ['plan'] },
      today: '2026-11-14',
    });
    expect(offRes.availableTools).not.toContain('plan');
    expect(offRes.openTools).toEqual([]);
  });

  it('Dates vetting distinguishes Active past starts from Next shift, ignores generic Lighter/Heavy keyDates, and rejects all-past cards', () => {
    const card = fixtureCard('body');
    card.keyDates = [
      { date: '2026-12-05', label: 'Current stretch ends', passed: false },
      { date: '2027-03-01', label: 'Lighter stretch begins', passed: false },
    ];
    const res = vetCardTools({
      card,
      periods: periodsOf(card, '2026-11-14'),
      options: COLD_BOARD_DEFAULTS,
      today: '2026-11-14',
    });
    expect(res.audit.dates.vetted).toBe(true);
    // 9 Nov 2026 started 5 days before `today` (14 Nov 2026): marked `started`, not `now`
    expect(res.dates.milestones[0]?.status).toBe('started');
    // 5 Dec 2026 is the first upcoming shift (21 days away): marked `next` with `In 21d`, and compound transition preserved
    expect(res.dates.milestones[1]?.status).toBe('next');
    expect(res.dates.milestones[1]?.relativeLabel).toBe('In 21d');
    expect(res.dates.milestones[1]?.title).toContain('Heavy stretch ends');
    // Generic "Lighter stretch begins" did not clobber the transition on 1 Mar 2027
    expect(res.dates.milestones[2]?.status).toBe('upcoming');
    expect(res.dates.milestones[2]?.title).toBe('Light stretch begins');

    // If all milestones are strictly before `today`, Dates fails vetting
    const expired = vetCardTools({
      card,
      periods: periodsOf(card, '2026-11-14'),
      options: COLD_BOARD_DEFAULTS,
      today: '2029-01-01',
    });
    expect(expired.audit.dates.vetted).toBe(false);
    expect(expired.audit.dates.reason).toMatch(/passed/i);
  });

  it('scrubs empty parenthetical artifacts inside vetted table, dates, plan, and info outputs', () => {
    const card = fixtureCard('body');
    if (card.v3) {
      card.v3.spans[0] = {
        ...card.v3.spans[0]!,
        asks: 'Guard your evenings () and keep warm (, ).',
        obstacle: 'Working late (Saturn, ) to catch up (;).',
        step: 'Stop by ten () and rest (,).',
      };
      if (card.v3.ladder) {
        card.v3.ladder.best = 'Sleep by eleven () five nights a week (,).';
      }
      if (card.v3.confirm) {
        card.v3.confirm.text = 'Since May 2025 (), have you slept worse (,)?';
      }
    }
    const res = vetCardTools({
      card,
      periods: periodsOf(card, '2026-11-14'),
      options: COLD_BOARD_DEFAULTS,
      confirmOn: false,
      today: '2026-11-14',
    });
    expect(res.table.rows[0]?.summary).toBe('Guard your evenings and keep warm.');
    expect(res.table.rows[0]?.trap).toBe('Working late (Saturn) to catch up.');
    expect(res.table.rows[0]?.step).toBe('Stop by ten and rest.');
    expect(res.plan.steps[0]?.text).toBe('Sleep by eleven five nights a week.');
    expect(res.info.waitingConfirm?.text).toBe('Since May 2025, have you slept worse?');
  });
});
