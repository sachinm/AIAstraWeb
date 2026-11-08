/**
 * Test fixture for GET /api/self/reading (server docs/reading-engine/58 §4.2, card contract doc 62): nine panels in
 * the server's display order, each a card of one to three dated lines under a header range. The chapters panel keeps
 * its previous / running / next chapters and has a line outside the header range; the body panel carries the standing
 * "not medical advice" note; one claim is vetoed by the purview. Plain text carries no chart terms; `detail`,
 * `claimIds` and `evidence` do, as the contract says. `gaps`, `purview` and `audit` are staff-only.
 */
import type { LineRange, SelfReading } from '../../lib/selfReadingApi';

export const CLOCK_LABELS: Record<string, string> = {
  dwisatpathi: 'Dwisaptati Sama',
  vimshottari: 'Vimshottari',
  chara: 'Chara',
};

/** the running sub-period of the reading clock */
export const SUB: LineRange = { from: '2026-03-02', to: '2027-05-14' };
/** the running main period */
export const MAIN: LineRange = { from: '2019-02-16', to: '2028-02-16' };
/** the running Varsha year */
export const YEAR: LineRange = { from: '2026-09-09', to: '2027-09-09' };

export const BODY_NOTE = 'What the chart and the sky put on the body. Not medical advice; nothing here names a condition.';

export function selfReadingFixture(clock = 'dwisatpathi'): SelfReading {
  return {
    asOf: '2026-11-07',
    digestVersion: 'd-2026-11-01',
    clock: {
      system: clock,
      label: CLOCK_LABELS[clock] ?? clock,
      reason: clock === 'dwisatpathi' ? 'preferred' : 'applicable',
      confirming: [
        { system: 'vimshottari', label: 'Vimshottari' },
        { system: 'chara', label: 'Chara' },
        { system: 'yogini', label: 'Yogini' },
      ],
      choices: Object.entries(CLOCK_LABELS).map(([system, label]) => ({ system, label })),
    },
    panels: [
      {
        id: 'diagnosis',
        technique: 'self.reading.diagnosis',
        title: 'In short',
        lead: '',
        status: 'ok',
        headerRange: SUB,
        lines: [
          { id: 'diagnosis.1', text: 'Your drive points at being seen for your work, and it stands on your own effort.', range: 'always', claimIds: ['lagna.lord_house'], certainty: 'fact', detail: 'L1 Su in D1.h10, friendly.' },
          { id: 'diagnosis.2', text: 'Until 14 May 2027 the pull is between what you want and the comfort of others.', range: SUB, claimIds: ['struggle.pressure'], certainty: 'strong', detail: 'Ve antardasha, Ve in D1.h7 against L1 in h10.' },
          { id: 'diagnosis.3', text: 'This stretch favours finishing, not starting.', range: SUB, claimIds: ['year.muntha'], certainty: 'moderate', detail: 'Sub lord Ve in a kendra from the running MD lord.' },
        ],
        claims: [],
        cached: true,
        ms: 0,
      },
      {
        id: 'chapters',
        technique: 'self.reading.chapters',
        title: 'Your chapters',
        lead: 'You are in a long chapter of building your own name.',
        status: 'ok',
        headerRange: MAIN,
        lines: [
          { id: 'chapters.1', text: 'From Feb 2010 to Feb 2019 the self was shaped by study and finding a voice.', range: { from: '2010-02-16', to: '2019-02-16' }, claimIds: ['chapters.previous'], certainty: 'moderate', detail: 'Me mahadasha, Me in D1.h2; confirmed by Vimshottari.' },
          { id: 'chapters.2', text: 'From Feb 2019 to Feb 2028 you are reaching past where you started.', range: MAIN, claimIds: ['chapters.running'], certainty: 'strong', detail: 'Ra mahadasha, Ra in D1.h10.' },
          { id: 'chapters.3', text: 'Until 14 May 2027 the focus turns to partners and comfort.', range: SUB, claimIds: ['chapters.running.sub'], certainty: 'moderate', detail: 'Ve antardasha, Ve in D1.h7.' },
        ],
        claims: [],
        chapters: [
          {
            kind: 'next',
            lord: 'Ju',
            lordLabel: 'Jupiter',
            from: '2028-02-16',
            to: '2037-02-16',
            text: null,
            detail: 'Ju mahadasha, lord of D1.h5 and h8.',
            certainty: 'split',
            houses: [5, 8],
            confirmations: [
              { system: 'vimshottari', label: 'Vimshottari', agrees: false, boundary: null },
              { system: 'chara', label: 'Chara', agrees: false, boundary: null },
            ],
            evidence: ['activation:dwisatpathi/1/Ju'],
          },
          {
            kind: 'running',
            lord: 'Ra',
            lordLabel: 'Rahu',
            from: '2019-02-16',
            to: '2028-02-16',
            text: 'A chapter of ambition and reaching past where you started.',
            detail: 'Ra mahadasha, Ra in D1.h10.',
            certainty: 'confirmed',
            houses: [10],
            sub: { lord: 'Ve', lordLabel: 'Venus', from: '2026-03-02', to: '2027-05-14', text: 'Now the focus turns to partners and comfort.', detail: 'Ve antardasha, Ve in D1.h7.', houses: [7] },
            nextSub: { lord: 'Su', lordLabel: 'Sun', from: '2027-05-14', to: '2027-09-20', houses: [1] },
            confirmations: [
              { system: 'vimshottari', label: 'Vimshottari', agrees: true, boundary: '2019-06-01' },
              { system: 'chara', label: 'Chara', agrees: true, boundary: '2018-11-12' },
              { system: 'yogini', label: 'Yogini', agrees: false, boundary: null },
            ],
            evidence: ['activation:dwisatpathi/1/Ra'],
          },
          {
            kind: 'previous',
            lord: 'Me',
            lordLabel: 'Mercury',
            from: '2010-02-16',
            to: '2019-02-16',
            text: 'A chapter of study and finding your voice.',
            detail: 'Me mahadasha, Me in D1.h2.',
            certainty: 'likely',
            houses: [2],
            confirmations: [{ system: 'vimshottari', label: 'Vimshottari', agrees: true, boundary: '2009-12-01' }],
            evidence: ['activation:dwisatpathi/1/Me'],
          },
        ],
        cached: true,
        ms: 0,
      },
      {
        id: 'lagna',
        technique: 'self.reading.lagna',
        title: 'Who you are',
        lead: 'You are built to lead from the front and be seen doing it.',
        status: 'ok',
        headerRange: 'always',
        lines: [
          { id: 'lagna.1', text: 'Your sense of self grows through your work and public role.', range: 'always', claimIds: ['lagna.lord_house'], certainty: 'fact', detail: 'Lagna Leo; lagna lord Su in D1.h10, dignity friendly.' },
          { id: 'lagna.2', text: 'You stand firmly when you lead from the front.', range: 'always', claimIds: ['lagna.dignity'], certainty: 'fact', detail: 'Su friendly in Taurus, star lord Mo.' },
        ],
        claims: [
          {
            id: 'lagna.lord_house',
            text: 'Your sense of self grows through your work and public role.',
            detail: 'Lagna Leo; lagna lord Su in D1.h10, dignity friendly.',
            certainty: 'fact',
            evidence: ['house:D1.1', 'planet:D1.Su'],
          },
        ],
        vetoed: [{ claimId: 'lagna.occupant', rule: 'purview.combust_occupant', text: 'People notice you before you speak.' }],
        cached: true,
        ms: 0,
      },
      {
        id: 'mind',
        technique: 'self.reading.mind',
        title: 'Your mind',
        lead: 'Your feelings run deep and settle slowly.',
        status: 'ok',
        headerRange: 'always',
        lines: [
          { id: 'mind.1', text: 'Your feelings run deep and settle slowly.', range: 'always', claimIds: ['mind.moon_sign'], certainty: 'fact', detail: 'Mo in Cancer, own sign, in D1.h12.' },
          { id: 'mind.2', text: 'You need quiet to think clearly.', range: 'always', claimIds: ['mind.mercury'], certainty: 'strong', detail: 'Me in D1.h12 with Mo.' },
        ],
        claims: [{ id: 'mind.moon_sign', text: 'You need quiet to think clearly.', detail: 'Mo in Cancer, own sign, in D1.h12.', certainty: 'fact', evidence: ['planet:D1.Mo'] }],
        cached: false,
        ms: 41,
      },
      {
        id: 'body',
        technique: 'self.reading.body',
        title: 'Your body',
        lead: '',
        status: 'ok',
        headerRange: SUB,
        note: BODY_NOTE,
        lines: [
          { id: 'body.1', text: 'Your footing is steady; you recover by keeping a regular rhythm.', range: 'always', claimIds: ['body.footing'], certainty: 'fact', detail: 'L1 Su friendly in D1.h10; lagna Leo, mid-degree.' },
          { id: 'body.2', text: 'Until 14 May 2027 rest matters more than usual; pace your days.', range: SUB, claimIds: ['body.running_wear'], certainty: 'strong', detail: 'Sub lord Ve rules D1.h3 and h10, aspects h6.' },
          { id: 'body.3', text: 'Pressure tends to show as tiredness rather than heat.', range: 'always', claimIds: ['body.d30_shape'], certainty: 'moderate', detail: 'D30 lagna in an earthy sign, Sa in D30.h1.' },
        ],
        claims: [],
        cached: false,
        ms: 23,
      },
      {
        id: 'atma',
        technique: 'self.reading.atma',
        title: "Your soul's aim",
        lead: 'You are here to learn to teach what you know.',
        status: 'ok',
        headerRange: 'always',
        lines: [{ id: 'atma.1', text: 'Sharing what you know is what makes you feel whole.', range: 'always', claimIds: ['atma.karaka'], certainty: 'fact', detail: 'Atmakaraka Ju in D9.h5.' }],
        claims: [{ id: 'atma.karaka', text: 'Sharing what you know is what makes you feel whole.', detail: 'Atmakaraka Ju in D9.h5.', certainty: 'fact', evidence: ['point:AK', 'planet:D9.Ju'] }],
        cached: true,
        ms: 0,
      },
      {
        id: 'yogas',
        technique: 'self.reading.yogas',
        title: 'Gifts and knots',
        lead: 'A gift for speech, and a knot around rest.',
        status: 'ok',
        headerRange: 'always',
        lines: [
          { id: 'yogas.1', text: 'Your words carry weight with others.', range: 'always', claimIds: ['yogas.gift'], certainty: 'fact', detail: 'Budha-Aditya yoga in D1.h2.' },
          { id: 'yogas.2', text: 'Rest does not come easily; you have to plan for it.', range: 'always', claimIds: ['yogas.knot'], certainty: 'fact', detail: 'Sa aspects D1.h12 lord Mo.' },
        ],
        claims: [{ id: 'yogas.gift', text: 'Your words carry weight with others.', detail: 'Budha-Aditya yoga in D1.h2.', certainty: 'fact', evidence: ['yoga:budhaditya'] }],
        cached: true,
        ms: 0,
      },
      {
        id: 'struggle',
        technique: 'self.reading.struggle',
        title: 'What you struggle with',
        lead: 'Slowing down is the hard part for you.',
        status: 'partial',
        headerRange: SUB,
        lines: [
          { id: 'struggle.1', text: 'You push on when rest would serve you better.', range: SUB, claimIds: ['struggle.pressure'], certainty: 'possible', detail: 'Sa aspects D1.h4 in the running Rahu antardasha.' },
          { id: 'struggle.2', text: 'Asking for help is hard, and it gets easier with people you trust.', range: 'always', claimIds: ['struggle.standing'], certainty: 'fact', detail: 'L12 Mo afflicted by Sa, held by Ju aspect.' },
        ],
        claims: [{ id: 'struggle.pressure', text: 'You push on when rest would serve you better.', detail: 'Sa aspects D1.h4 in the running Rahu antardasha.', certainty: 'likely', evidence: ['activation:dwisatpathi/2/Sa'] }],
        cached: false,
        ms: 18,
      },
      {
        id: 'year',
        technique: 'self.reading.year',
        title: 'This year',
        lead: 'A year to step forward.',
        status: 'ok',
        headerRange: YEAR,
        lines: [
          { id: 'year.1', text: 'This year rewards starting something of your own.', range: YEAR, claimIds: ['year.muntha'], certainty: 'moderate', detail: 'Muntha in D1.h10 of the 2026 varshaphala.' },
          { id: 'year.2', text: 'Through mid December, small steps count for more than big ones.', range: { from: '2026-11-01', to: '2026-12-15' }, claimIds: ['year.mudda'], certainty: 'possible', detail: 'Mudda Me sub-range inside the 2026 year.' },
        ],
        claims: [{ id: 'year.muntha', text: 'This year rewards starting something of your own.', detail: 'Muntha in D1.h10 of the 2026 varshaphala.', certainty: 'likely', evidence: ['varsha:2026'] }],
        cached: false,
        ms: 77,
      },
    ],
    question: {
      claimId: 'lagna.lord_house',
      panel: 'lagna',
      text: 'Do you feel most yourself when you are leading at work?',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'partly', label: 'Partly' },
        { value: 'no', label: 'No' },
        { value: 'skip', label: 'Skip' },
      ],
    },
    gaps: ['STAFF-GAP: year.varsha_missing_point'],
    purview: [
      { rule: 'PURVIEW-neecha_bhanga_l1', source: 'digest', action: 'override', affects: ['body.1'], text: 'the weak-footing line was replaced because a cancellation lifts it.' },
      { rule: 'PURVIEW-combust_occupant', source: 'digest', action: 'veto', affects: ['lagna.occupant'], text: 'a claim about how people first see you was removed.' },
    ],
    audit: { verdict: 'pass', checked: 21, failures: [] },
    dossierId: 'DOSSIER-7f3a',
    builtLine: 'Built 7 Nov 2026, next check 14 May 2027',
  };
}
