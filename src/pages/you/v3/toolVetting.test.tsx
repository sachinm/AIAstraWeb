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
import { coveringPeriod } from './faces/CalendarTool';
import SeasonsCard from './SeasonsCard';
import { selfV3Fixture } from './selfV3.fixture';
import { formatDisplayDate, scrubEmptyRefs, vetCardTools, vettedTimeframeGroupBys } from './toolVetting';

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
    render(<ChartDetails area={area} />);
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
      periods: periodsOf(card),
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
      periods: periodsOf(card),
      options: COLD_BOARD_DEFAULTS,
      confirmOn: true,
      builtOn: '2026-11-09',
      today: '2026-11-14',
    });
    expect(res.availableTools).toEqual(['table', 'calendar', 'dates', 'timeframe']);
    expect(res.audit.plan.vetted).toBe(false);
  });

  it('suppresses table, calendar, dates, timeframe and info on a Phase A card with < 2 written stretches (stuck), keeping only plan', () => {
    const card = fixtureCard('stuck');
    const res = vetCardTools({
      card,
      periods: periodsOf(card),
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
    card.rail = card.rail.slice(0, 1);
    const res = vetCardTools({
      card,
      periods: periodsOf(card),
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
      periods: periodsOf(card),
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
      periods: periodsOf(staleCard),
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
      periods: periodsOf(card),
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
    const periods = periodsOf(card);
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
    const periods = periodsOf(card);
    expect(vettedTimeframeGroupBys(periods)).toEqual(['years', 'decades']);
  });
});

describe('Toolbar progressive disclosure, required Chart details, and enhanced tool panels in DOM', () => {
  const fx = selfV3Fixture();

  it('hides the optional tool-switch group completely when zero optional tools pass vetting, while preserving Chart details on every face and compact view', () => {
    const card = fixtureCard('stuck');
    if (card.v2?.card) card.v2.card.ladder = null;
    card.rail = card.rail.slice(0, 1);
    const onDetails = vi.fn();
    const opts: CardOptions = { ...cardNow(fx.layout, 'stuck'), tools: [...CARD_TOOLS] };

    const { rerender } = render(<SeasonsCard card={card} options={opts} onOptions={() => {}} onDetails={onDetails} />);
    expect(screen.queryByTestId('tool-switch')).toBeNull();
    expect(screen.queryByTestId('tool-panels')).toBeNull();
    expect(screen.getByTestId('toolbar-details')).toBeVisible();
    expect(screen.getByTestId('toolbar-details')).not.toHaveAttribute('aria-pressed');
    expect(screen.getByTestId('card-details-open')).toBeVisible();

    for (const face of ['light', 'breakdown', 'research', 'read'] as const) {
      rerender(<SeasonsCard card={card} options={{ ...opts, face }} onOptions={() => {}} onDetails={onDetails} />);
      expect(screen.queryByTestId('tool-switch')).toBeNull();
      expect(screen.getByTestId('toolbar-details')).toBeVisible();
      expect(screen.getByTestId('card-details-open')).toBeVisible();
    }

    fireEvent.click(screen.getByTestId('toolbar-details'));
    expect(onDetails).toHaveBeenCalledTimes(1);

    const compact = render(<CompactCard card={card} options={opts} onOptions={() => {}} onDetails={onDetails} />);
    expect(within(compact.container).getByTestId('toolbar-details')).toBeVisible();
    expect(within(compact.container).getByTestId('card-details-open')).toBeVisible();
  });

  it('prevents board-wide tool settings from opening unvetted empty panels on Phase A cards', () => {
    const card = fixtureCard('stuck');
    const opts: CardOptions = { ...cardNow(fx.layout, 'stuck'), tools: [...CARD_TOOLS] };
    render(<SeasonsCard card={card} options={opts} onOptions={() => {}} onDetails={() => {}} />);

    // Only Plan is vetted on `stuck`: toolbar shows only `tool-plan`, and only `tool-panel-plan` opens
    expect(screen.getByTestId('tool-plan')).toBeInTheDocument();
    expect(screen.queryByTestId('tool-table')).toBeNull();
    expect(screen.queryByTestId('tool-calendar')).toBeNull();
    expect(screen.queryByTestId('tool-dates')).toBeNull();
    expect(screen.queryByTestId('tool-timeframe')).toBeNull();
    expect(screen.queryByTestId('tool-info')).toBeNull();

    expect(screen.getByTestId('tool-panel-plan')).toBeInTheDocument();
    expect(screen.queryByTestId('tool-panel-table')).toBeNull();
    expect(screen.queryByTestId('tool-panel-calendar')).toBeNull();
  });

  it('TableTool dynamically omits empty Tone/Step columns and skips unwritten rows; panel close button dismisses the tool', () => {
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
    const onOptions = vi.fn();
    render(<SeasonsCard card={card} options={{ ...COLD_BOARD_DEFAULTS, tools: ['table'] }} onOptions={onOptions} onDetails={() => {}} />);

    const panel = screen.getByTestId('tool-table-panel');
    const headers = within(panel).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Period', 'Focus', 'What it asks']);
    expect(within(panel).getByTestId('table-row-0')).toBeInTheDocument();
    expect(within(panel).getByTestId('table-row-1')).toBeInTheDocument();
    expect(within(panel).queryByTestId('table-row-2')).toBeNull();

    fireEvent.click(screen.getByTestId('tool-close-table'));
    expect(onOptions).toHaveBeenCalledWith({ tools: [] });
  });

  it('DatesTool shows chronological turning points with status and selects the target period; CalendarTool highlights turning points', () => {
    const card = fixtureCard('body');
    render(
      <SeasonsCard
        card={card}
        options={{ ...COLD_BOARD_DEFAULTS, tools: ['dates', 'calendar'] }}
        builtOn="2026-11-09"
        onOptions={() => {}}
        onDetails={() => {}}
      />,
    );

    const datesPanel = screen.getByTestId('tool-dates-panel');
    expect(datesPanel).toHaveTextContent('9 Nov 2026');
    expect(datesPanel).toHaveTextContent('5 Dec 2026');
    expect(datesPanel).toHaveTextContent('1 Mar 2027');
    expect(datesPanel).toHaveTextContent('Heavy stretch ends');

    // Clicking the 1 Mar 2027 turning point selects period 2 on the card
    fireEvent.click(within(datesPanel).getByTestId('date-2'));
    expect(screen.getByTestId('period-2')).toHaveAttribute('aria-selected', 'true');

    // CalendarTool renders its legend and marks turning-point days across all 12 months
    expect(screen.getByTestId('calendar-legend')).toHaveTextContent('Turning point');
    expect(screen.getByTestId('day-2026-12-05')).toHaveAttribute('data-turning-point', 'true');
    expect(screen.getByTestId('day-2027-03-01')).toHaveAttribute('data-turning-point', 'true');
  });

  it('keeps all vetted calendar months reachable in CSS (no nth-child(n+4) hiding) and resolves nested sub-periods over overarching rails', () => {
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
        to: '2027-01-01',
        label: 'now → 1 Jan 2027',
        tone: 'light',
        note: 'Inner opening',
        current: false,
        span: null,
        text: ['Doors open from June through New Year.'],
      },
      {
        from: '2027-01-01',
        to: '2028-02-16',
        label: '1 Jan 2027 → 16 Feb 2028',
        tone: 'mixed',
        note: 'Closing sub-period',
        current: false,
        span: null,
        text: ['Consolidate before the chapter turns.'],
      },
    ];

    const periods = periodsOf(chapterCard);
    // Duplicate "now → 1 Jan 2027" labels are disambiguated automatically
    expect(periods[1]!.item.label).toBe('15 Nov 2025 → 1 Jan 2027');
    expect(periods[2]!.item.label).toBe('1 Jun 2026 → 1 Jan 2027');

    // Nested specificity: inner sub-periods win over the 18-year overarching rail
    expect(coveringPeriod(periods, '2026-11-20')?.index).toBe(2);
    expect(coveringPeriod(periods, '2027-02-10')?.index).toBe(3);

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
    const res = vetCardTools({ card, periods: periodsOf(card), options: COLD_BOARD_DEFAULTS, today: '2026-11-14' });
    expect(res.audit.calendar.vetted).toBe(false);
    expect(res.audit.calendar.reason).toMatch(/same shade/i);
  });

  it('respects options.plan === "without" and suppresses duplicate inline PlanList on Read and Breakdown when Plan tool is open', () => {
    const card = fixtureCard('body');
    const offRes = vetCardTools({
      card,
      periods: periodsOf(card),
      options: { ...COLD_BOARD_DEFAULTS, plan: 'without', tools: ['plan'] },
      today: '2026-11-14',
    });
    expect(offRes.availableTools).not.toContain('plan');
    expect(offRes.openTools).toEqual([]);

    // On Breakdown with Plan tool open: exactly ONE `section-plan` exists (inside `tool-panel-plan`), not duplicated below Breakdown blocks
    const { rerender } = render(
      <SeasonsCard
        card={card}
        options={{ ...COLD_BOARD_DEFAULTS, face: 'breakdown', tools: ['plan'] }}
        onOptions={() => {}}
        onDetails={() => {}}
      />,
    );
    expect(screen.getByTestId('tool-panel-plan')).toBeInTheDocument();
    expect(screen.getAllByTestId('section-plan')).toHaveLength(1);

    // On Read (short) with Plan tool open: Show more does NOT advertise "4 steps to take", and expanding does not render a second PlanList
    rerender(
      <SeasonsCard
        card={card}
        options={{ ...COLD_BOARD_DEFAULTS, face: 'read', start: 'short', tools: ['plan'] }}
        onOptions={() => {}}
        onDetails={() => {}}
      />,
    );
    expect(screen.getByTestId('show-more-toggle').textContent).not.toMatch(/steps to take/i);
    fireEvent.click(screen.getByTestId('show-more-toggle'));
    expect(screen.getAllByTestId('section-plan')).toHaveLength(1);
  });

  it('Dates vetting distinguishes Active past starts from Next shift, ignores generic Lighter/Heavy keyDates, and rejects all-past cards', () => {
    const card = fixtureCard('body');
    card.keyDates = [
      { date: '2026-12-05', label: 'Current stretch ends', passed: false },
      { date: '2027-03-01', label: 'Lighter stretch begins', passed: false },
    ];
    const res = vetCardTools({
      card,
      periods: periodsOf(card),
      options: COLD_BOARD_DEFAULTS,
      today: '2026-11-14',
    });
    expect(res.audit.dates.vetted).toBe(true);
    // 9 Nov 2026 started 5 days before `today` (14 Nov 2026): marked `started` ("Active"), not `now`
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
      periods: periodsOf(card),
      options: COLD_BOARD_DEFAULTS,
      today: '2029-01-01',
    });
    expect(expired.audit.dates.vetted).toBe(false);
    expect(expired.audit.dates.reason).toMatch(/passed/i);
  });

  it('scrubs empty parenthetical artifacts across primary card headline, Read, Light, and Breakdown faces', () => {
    const card = fixtureCard('body');
    if (card.v3) {
      card.v3.line = 'Rest () stays thin (,) until 5 December (Mars ()).';
      card.v3.spans[0] = {
        ...card.v3.spans[0]!,
        asks: 'Guard your evenings () and keep warm (, ).',
        obstacle: 'Working late (Saturn, ) to catch up (;).',
        step: 'Stop by ten () and rest (,).',
      };
      if (card.v3.pattern) card.v3.pattern.text = 'Pushing past tiredness () costs a week (,).';
    }
    const { rerender } = render(<SeasonsCard card={card} options={COLD_BOARD_DEFAULTS} onOptions={() => {}} onDetails={() => {}} />);
    expect(screen.getByTestId('card-line')).toHaveTextContent('Rest stays thin until 5 December (Mars).');
    expect(screen.getByTestId('stretch-text')).toHaveTextContent('Guard your evenings and keep warm.');

    rerender(<SeasonsCard card={card} options={{ ...COLD_BOARD_DEFAULTS, face: 'light' }} onOptions={() => {}} onDetails={() => {}} />);
    expect(screen.getByTestId('light-sentence')).toHaveTextContent('Guard your evenings and keep warm.');
    expect(screen.getByTestId('stretch-step')).toHaveTextContent('Stop by ten and rest.');

    rerender(<SeasonsCard card={card} options={{ ...COLD_BOARD_DEFAULTS, face: 'breakdown' }} onOptions={() => {}} onDetails={() => {}} />);
    expect(screen.getByTestId('block-trap')).toHaveTextContent('Working late (Saturn) to catch up.');
    expect(screen.getByTestId('block-pattern-0')).toHaveTextContent('Pushing past tiredness costs a week.');
  });
});
