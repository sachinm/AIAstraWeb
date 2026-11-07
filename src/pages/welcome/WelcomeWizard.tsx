/**
 * The personalization wizard (server docs/reading-engine/52 §3): after birth details, six short steps the person can
 * skip or step back through at any time, one or two questions each, every one with "I'd rather not say" and a top-right
 * technique badge naming which board technique asks it and why. The answers land in person_facts.
 */
import { useEffect, useState } from 'react';
import { fetchFacts, saveFacts } from '../../lib/profileApi';
import { track } from '../../lib/events';
import SelfieStep from './SelfieStep';

type Opt = { key: string; label: string };
type Question = { fact: string; text: string; techniqueBadge: string; options: Opt[]; multi?: number };
type Step = { id: string; title: string; questions: Question[] };

const DECLINE = '__declined__';

export const QUESTION_TECHNIQUE_BADGES: Record<string, string> = {
  'wizard.selfie': 'companion.wizard · Profile Identity',
  'place.current': 'lucky.day_tables · self.activation · Local Sky & Timing',
  'work.status': 'work.present_tone · work.horizons · 10th/6th Bhava Career Context',
  'work.level': 'work.present_tone · work.horizons · Role & Scope Calibration',
  'love.status': 'love.activation · love.promise · 7th Bhava & Navamsa Context',
  'family.children': 'self.promise · love.promise · 5th/4th Bhava Family Context',
  'self.focus': 'self.activation · self.promise · Focus Priority Weighting',
};

export const STEPS: Step[] = [
  { id: 'selfie', title: 'A photo of you', questions: [] },
  {
    id: 'place',
    title: 'Where you are',
    questions: [
      {
        fact: 'place.current',
        text: 'Where do you live now?',
        techniqueBadge: QUESTION_TECHNIQUE_BADGES['place.current']!,
        options: [{ key: 'use_location', label: 'Use my location' }],
      },
    ],
  },
  {
    id: 'work',
    title: 'Work',
    questions: [
      {
        fact: 'work.status',
        text: 'Do you have a job right now?',
        techniqueBadge: QUESTION_TECHNIQUE_BADGES['work.status']!,
        options: [
          { key: 'yes', label: 'Yes' },
          { key: 'between_jobs', label: 'Between jobs' },
          { key: 'own_business', label: 'Own business' },
          { key: 'studying', label: 'Studying' },
          { key: 'retired', label: 'Retired' },
        ],
      },
      {
        fact: 'work.level',
        text: 'What best describes your work?',
        techniqueBadge: QUESTION_TECHNIQUE_BADGES['work.level']!,
        options: [
          { key: 'hourly', label: 'Hourly or shift work' },
          { key: 'employee', label: 'Employee' },
          { key: 'specialist', label: 'Specialist or professional' },
          { key: 'manager', label: 'I manage people' },
          { key: 'senior_leader', label: 'Senior leader' },
          { key: 'owner_alone', label: 'Own business, on my own' },
          { key: 'owner_staff', label: 'Own business, with staff' },
          { key: 'several_businesses', label: 'Several businesses' },
        ],
      },
    ],
  },
  {
    id: 'love',
    title: 'Love',
    questions: [
      {
        fact: 'love.status',
        text: 'Right now are you…',
        techniqueBadge: QUESTION_TECHNIQUE_BADGES['love.status']!,
        options: [
          { key: 'single', label: 'Single' },
          { key: 'dating', label: 'Dating' },
          { key: 'committed', label: 'In a relationship' },
          { key: 'married', label: 'Married' },
          { key: 'separated', label: 'Separated' },
          { key: 'complicated', label: "It's complicated" },
        ],
      },
    ],
  },
  {
    id: 'family',
    title: 'Family',
    questions: [
      {
        fact: 'family.children',
        text: 'Children?',
        techniqueBadge: QUESTION_TECHNIQUE_BADGES['family.children']!,
        options: [
          { key: 'none', label: 'None' },
          { key: 'expecting', label: 'Expecting' },
          { key: 'young', label: 'Yes, young' },
          { key: 'grown', label: 'Yes, grown' },
        ],
      },
    ],
  },
  {
    id: 'focus',
    title: 'What matters now',
    questions: [
      {
        fact: 'self.focus',
        text: 'What matters most to you now? Pick up to three.',
        techniqueBadge: QUESTION_TECHNIQUE_BADGES['self.focus']!,
        multi: 3,
        options: ['career', 'money', 'love', 'family', 'home', 'learning', 'travel', 'health', 'creativity', 'spirituality'].map((k) => ({
          key: k,
          label: k[0]!.toUpperCase() + k.slice(1),
        })),
      },
    ],
  },
];

const chip = 'min-h-[44px] rounded-xl border px-3.5 py-2 text-left text-sm transition-colors';

export default function WelcomeWizard({ onFinish, inModal = false }: { onFinish: () => void; inModal?: boolean }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [city, setCity] = useState('');
  const step = STEPS[i];

  useEffect(() => {
    if (!inModal) return;
    let active = true;
    fetchFacts()
      .then((res) => {
        if (!active || !res?.facts) return;
        const prefilled: Record<string, string> = {};
        for (const [k, row] of Object.entries(res.facts)) {
          if (row?.value === 'declined') prefilled[k] = DECLINE;
          else if (typeof row?.value === 'string' && row.value) prefilled[k] = row.value;
        }
        if (prefilled['place.current'] && !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(prefilled['place.current'])) {
          setCity(prefilled['place.current']);
        }
        setAnswers((prev) => ({ ...prefilled, ...prev }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [inModal]);

  const finish = async (how: 'done' | 'skipped') => {
    const today = new Date().toISOString().slice(0, 10);
    await saveFacts({ [`wizard.${how}`]: today }).catch(() => false);
    track('question_answer', 'welcome', how, { step: step?.id ?? 'end' });
    onFinish();
  };

  const next = () => {
    if (!step) return;
    const facts: Record<string, string | null> = {};
    for (const q of step.questions) {
      const a = answers[q.fact];
      if (a === undefined) continue;
      facts[q.fact] = a === DECLINE ? null : a;
    }
    if (step.id === 'place' && city.trim() && answers['place.current'] === undefined) facts['place.current'] = city.trim();
    if (Object.keys(facts).length) void saveFacts(facts).catch(() => false);
    track('question_answer', 'welcome', step.id, { answered: Object.keys(facts).length });
    if (i + 1 >= STEPS.length) setI(STEPS.length);
    else setI(i + 1);
  };

  const back = () => {
    setI((prev) => Math.max(0, prev - 1));
  };

  const pick = (q: Question, key: string) => {
    setAnswers((a) => {
      if (key === DECLINE || !q.multi) return { ...a, [q.fact]: key };
      const cur = a[q.fact] && a[q.fact] !== DECLINE ? a[q.fact]!.split(',') : [];
      const has = cur.includes(key);
      const nextList = has ? cur.filter((k) => k !== key) : cur.length < q.multi ? [...cur, key] : cur;
      return { ...a, [q.fact]: nextList.join(',') };
    });
  };

  const useLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setAnswers((a) => ({ ...a, 'place.current': `${p.coords.latitude.toFixed(2)},${p.coords.longitude.toFixed(2)}` })),
      () => undefined,
      { timeout: 10_000 },
    );
  };

  const multiCol = (step?.questions.length ?? 0) >= 2;

  return (
    <div
      className={
        inModal
          ? 'flex min-h-0 w-full flex-1 flex-col overflow-hidden text-white'
          : 'mx-auto my-4 flex h-[min(660px,84vh)] w-[min(880px,94vw)] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0d0c24]/90 p-5 text-white shadow-2xl'
      }
      data-testid="welcome-wizard"
    >
      {/* Fixed Progress Header */}
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div className="text-sm text-white/60">{i < STEPS.length ? `Step ${i + 1} of ${STEPS.length}` : 'All set'}</div>
        {i < STEPS.length && (
          <button type="button" onClick={() => void finish('skipped')} className="min-h-[36px] text-sm text-white/70 underline underline-offset-4 hover:text-white">
            Skip for now
          </button>
        )}
      </div>
      <div className="mb-4 flex shrink-0 items-center gap-1.5" role="group" aria-label="Wizard steps">
        {STEPS.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setI(idx)}
            aria-label={`Go to step ${idx + 1}: ${s.title}`}
            data-testid={`wizard-step-dot-${idx}`}
            className={`h-1.5 flex-1 rounded-full transition-colors ${idx <= i ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-white/15 hover:bg-white/30'}`}
          />
        ))}
      </div>

      {/* Scrollable Inner Questions Container */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1" data-testid="wizard-questions-scroll">
        {i === 0 && (
          <SelfieStep
            onDone={() => setI(1)}
            onSkip={() => {
              void saveFacts({ 'wizard.selfie': 'skipped' });
              setI(1);
            }}
          />
        )}

        {i > 0 && step && (
          <div data-testid={`step-${step.id}`} className="flex h-full flex-col">
            <h2 className="mb-3 text-xl font-semibold">{step.title}</h2>
            <div
              data-testid="wizard-questions-grid"
              className={multiCol ? 'grid gap-4 md:grid-cols-2' : 'space-y-4'}
            >
              {step.questions.map((q) => (
                <div
                  key={q.fact}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  data-testid={`question-panel-${q.fact}`}
                >
                  <fieldset>
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <legend className="font-medium text-white/90">{q.text}</legend>
                      <span
                        data-testid="question-technique-badge"
                        className="inline-flex shrink-0 items-center rounded-full border border-purple-400/30 bg-purple-500/15 px-2.5 py-0.5 text-[11px] font-medium text-purple-200"
                      >
                        {q.techniqueBadge}
                      </span>
                    </div>
                    {step.id === 'place' && (
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City, country"
                        aria-label="City, country"
                        className="mb-2 min-h-[44px] w-full rounded-xl border border-white/15 bg-white/5 px-4 text-white placeholder-white/40"
                      />
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {q.options.map((o) => {
                        const selected = q.multi ? (answers[q.fact] ?? '').split(',').includes(o.key) : answers[q.fact] === o.key;
                        return (
                          <button
                            key={o.key}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => (o.key === 'use_location' ? useLocation() : pick(q, o.key))}
                            className={`${chip} ${selected ? 'border-purple-400 bg-white/15 text-white' : 'border-white/15 bg-white/5 text-white/85 hover:bg-white/10'}`}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        aria-pressed={answers[q.fact] === DECLINE}
                        onClick={() => pick(q, DECLINE)}
                        className={`${chip} ${answers[q.fact] === DECLINE ? 'border-purple-400 bg-white/15 text-white' : 'border-white/10 text-white/60 hover:bg-white/10'}`}
                      >
                        I'd rather not say
                      </button>
                    </div>
                  </fieldset>
                </div>
              ))}
            </div>
          </div>
        )}

        {i >= STEPS.length && (
          <div data-testid="step-done" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-2 text-2xl font-semibold">Thank you</h2>
            <p className="mb-6 text-white/75">Your readings will speak to where you are now.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                data-testid="wizard-back"
                onClick={back}
                className="min-h-[46px] rounded-xl border border-white/20 bg-white/5 px-5 font-medium text-white/85 hover:bg-white/10"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => void finish('done')}
                className="min-h-[46px] flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-medium text-white"
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Footer Navigation for Steps 2..6 */}
      {i > 0 && i < STEPS.length && step && (
        <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-white/10 pt-3">
          <button
            type="button"
            data-testid="wizard-back"
            onClick={back}
            className="min-h-[46px] rounded-xl border border-white/20 bg-white/5 px-5 font-medium text-white/85 hover:bg-white/10"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => void next()}
            className="min-h-[46px] flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-medium text-white"
          >
            {i + 1 >= STEPS.length ? 'Finish' : 'Next'}
          </button>
        </div>
      )}
    </div>
  );
}
