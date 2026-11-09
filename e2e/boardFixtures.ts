/** Stand-in board data for the e2e specs: You, Love, Work, Lucky times and the life reading. */
export const YOU_BOARD = {
  asOf: '2026-11-05',
  tone: {
    tone: 'open',
    confidence: 'likely',
    families: [
      { family: 'main', vote: 'support' },
      { family: 'rasi', vote: 'support' },
      { family: 'annual', vote: 'neutral' },
    ],
    date: '2027-05-31',
  },
  supports: [
    { text: 'Your sense of self has firm footing.', evidence: ['D1.h1 lord Ma in h10 (kendra)'] },
    { text: 'Something steady watches over your feelings.', evidence: ['D1.Mo aspected_by Ju'] },
  ],
  pressures: [
    { text: 'A heavy influence presses on your peace of mind.', until: '2031-03-01', evidence: ['D1.h4 occupant Sa'] },
    { text: 'Your ideas and learning takes more effort than it looks.', until: null, evidence: ['D1.h5 lord Su in h8 (dusthana)'] },
  ],
  ahead: [
    { subarea: 'growth', label: 'A clear stretch for a fresh start', from: '2026-11-05', to: '2027-05-31', side: 'support', grade: 'strong', systems: ['vimshottari', 'yogini'] },
    { subarea: 'mind', label: 'A slower stretch: give it room', from: '2027-06-01', to: '2028-10-31', side: 'test', grade: 'moderate', systems: ['vimshottari'] },
    { subarea: 'purpose', label: 'A good stretch to build', from: '2026-11-05', to: '2027-05-31', side: 'support', grade: 'moderate', systems: ['vimshottari'] },
  ],
  year: { year: 2026, note: "This year's chart backs you: a good year to begin something of your own." },
  back: [
    { month: '2026-02', side: 'support', label: 'a lighter, stronger stretch for you began' },
    { month: '2025-09', side: 'test', label: 'a heavier stretch for you began' },
  ],
  notes: [],
  characterArc: {
    headline: 'How the last ten years shaped you, where your character stands now, and who you are becoming over the next decade',
    pastDecade: {
      stage: 'past_10y',
      label: 'Last 10 Years',
      windowLabel: 'Ages 24–34 (2016–2026)',
      headline: 'Searching for inner peace and a steady home base',
      summary: 'The last decade shaped you through your private life—learning what kind of home environment and emotional boundaries you need to feel settled.',
      anchorTrait: 'Emotional depth',
    },
    presentNow: {
      stage: 'now',
      label: 'Who You Are Now',
      windowLabel: 'Age 34 (2026)',
      headline: 'Purposeful competence and earned respect',
      summary: 'Today you carry natural authority in your work and commitments, backed by a track record of real follow-through.',
      anchorTrait: 'Executive steadiness',
    },
    nextDecade: {
      stage: 'next_10y',
      label: 'Next 10 Years',
      windowLabel: 'Ages 34–44 (2026–2036)',
      headline: 'Stepping into advisory trust and broader horizons',
      summary: 'In the next ten years people increasingly look to your perspective and fairness to help guide long-term decisions.',
      anchorTrait: 'Trusted perspective',
    },
  },
  personalityAndJoy: {
    headline: 'Warm emotional steadiness paired with perceptive, hands-on precision',
    personalitySummary: 'People experience you as calm, loyal, and soothing to be around—with a mind that breaks complex problems into clean, workable steps.',
    emotionalMindStyle: 'Your heart settles through sensory steadiness—good food, familiar surroundings, music, and unhurried rhythms.',
    intellectualWitStyle: 'Your analytical mind is remarkably precise—you spot how systems fit together and take pleasure in clean craftsmanship.',
    whatFeelsGood: [
      {
        title: 'Cooking, music & tactile comfort at home',
        whyItFits: 'Unhurried sensory pleasures restore your emotional balance deeply.',
      },
      {
        title: 'Mastering a detailed craft or system',
        whyItFits: 'Refining a skill, organizing a workflow, or solving a puzzle gives you clean flow.',
      },
      {
        title: 'Building tangible, lasting craft',
        whyItFits: 'Working on something you can see, measure, and refine brings quiet satisfaction.',
      },
      {
        title: 'Mindful wellness & nature walks',
        whyItFits: 'Simple, rhythmic daily health habits keep your mind light.',
      },
    ],
    rechargeRule: 'You recharge fastest in a calm, well-ordered home base with unhurried evenings and one-on-one time with people you trust.',
  },
};

export const LOVE_BOARD = {
  asOf: '2026-11-05',
  tone: {
    tone: 'demanding',
    confidence: 'split',
    families: [
      { family: 'main', vote: 'test' },
      { family: 'transit', vote: 'test' },
    ],
    date: '2027-03-03',
  },
  supports: [{ text: 'Your partnerships has firm footing.', evidence: ['D1.h7 lord Ve in h7 (kendra)'] }],
  pressures: [{ text: 'A heavy influence presses on your partnerships.', until: '2027-03-01', evidence: ['D1.h7 aspected_by Sa'] }],
  ahead: [
    { subarea: 'health', label: 'A tense stretch: go gently', from: '2026-11-05', to: '2027-03-02', side: 'test', grade: 'moderate', systems: ['vimshottari'] },
    { subarea: 'friends', label: 'A good stretch', from: '2027-04-01', to: '2027-12-31', side: 'support', grade: 'moderate', systems: ['vimshottari'] },
  ],
  year: { year: 2026, note: "This year's chart asks for patience in love: go slowly with big decisions." },
  back: [],
  notes: [],
};

export const WORK_MAP = {
  asOf: '2026-11-05',
  month: '2026-11',
  present: {
    tone: 'demanding',
    confidence: 'likely',
    votes: [{ family: 'main', label: 'Main clock', vote: 'test', planet: 'Sa' }],
    available: 5,
    agree: 3,
    ease_date: '2026-12-10',
    window_end: null,
    next_window_start: null,
    security: 'watch',
  },
  ahead: [
    { subarea: 'promotion', side: 'support', from: '2027-03-01', to: '2027-05-31', peakMonth: '2027-04', band: 'high', score: 9, families: ['main', 'rasi', 'transit'], drivers: ['Ju'] },
  ],
  horizons: [
    { months: 1, best: null, hardest: null, quiet: true },
    { months: 3, best: null, hardest: null, quiet: true },
    { months: 6, best: { subarea: 'promotion', side: 'support', from: '2027-03-01', to: '2027-05-31', peakMonth: '2027-04', band: 'high', score: 9, families: ['main'], drivers: ['Ju'] }, hardest: null, quiet: false },
    { months: 12, best: null, hardest: null, quiet: true },
  ],
  security: [],
  back: [{ month: '2026-03', side: 'test', band: 'moderate', label: 'a demanding stretch at work began' }],
  notes: [],
};

export const LUCKY_CATALOG = [
  {
    area: 'work',
    label: 'Work',
    scenarios: [
      { id: 'work.sign_contract', label: 'Sign a contract', ask: null },
      { id: 'work.hard_talk_boss', label: 'A hard talk with the boss', ask: 'who' },
    ],
  },
  {
    area: 'love',
    label: 'Love',
    scenarios: [{ id: 'love.first_date', label: 'A first date', ask: 'relationship' }],
  },
];

export const LIFE_READING = {
  status: 'ok',
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
      cause: {
        planets: ['Rahu', 'Saturn'],
        dashas: ['Vimshottari Moon–Rahu (to 7 Feb 2027)'],
        text: 'Mostly because the chapter you are in now leans against this part of life.',
      },
      improves: [
        { from: '2027-02-07', to: '2027-09-15', md: 'Moon', ad: 'Saturn', systems: ['Vimshottari', 'Yogini'], grade: 'moderate', basis: 'moderate: two systems agree' },
      ],
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
      improves: [
        { from: '2028-03-01', to: '2029-01-10', md: 'Mars', ad: 'Jupiter', systems: ['Vimshottari', 'Narayana', 'Yogini', 'Dwisaptati'], grade: 'strong', basis: 'strong: four systems agree, the year chart confirms' },
      ],
      solution: ['Keep a simple monthly record of what comes in and what goes out.'],
      grade: 'strong',
      basis: 'strong: four systems agree, the year chart confirms',
    },
  ],
};

export function buildLuckyRange(picks: Array<{ scenario: string; shown: boolean; answers: Record<string, string> }>) {
  const today = new Date().toISOString().slice(0, 10);
  const days = [];
  for (let i = -7; i <= 14; i++) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const layers = Object.fromEntries(
      picks
        .filter((p) => p.shown)
        .map((p, k) => [
          p.scenario,
          {
            verdict: 'good',
            windows: [
              {
                from: 600 + k * 120,
                to: 660 + k * 120,
                score: 6,
                reasons: [
                  { key: 'abhijit', scope: 'general' },
                  { key: 'hora:Jupiter', scope: 'general' },
                  { key: 'personal:tara_good', scope: 'personal' },
                ],
                reasonKeys: ['abhijit', 'hora:Jupiter', 'personal:tara_good'],
              },
            ],
            dayReasons: [],
          },
        ]),
    );
    days.push({
      date: d.toISOString().slice(0, 10),
      weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()],
      sunrise: 400,
      sunset: 1020,
      personal: { tara_good: true, moon_good: true },
      avoid: [{ kind: 'rahu_kalam', from: 780, to: 860 }],
      good: [{ kind: 'abhijit', from: 690, to: 732 }],
      yoga: { name: 'Siddha', endHour: 18.5 },
      karana: { name: 'Bava', endHour: 14.25 },
      layers,
    });
  }
  return {
    status: 'ok',
    place: 'sanjose',
    today,
    nowMin: 700,
    from: days[0]!.date,
    to: days[days.length - 1]!.date,
    missing: [],
    now: { kind: 'good', what: 'abhijit', until: 732 },
    days,
  };
}
