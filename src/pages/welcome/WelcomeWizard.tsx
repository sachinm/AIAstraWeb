/**
 * The personalization wizard (server docs/reading-engine/52 §3): after birth details, seven short steps the person can
 * skip at any time, one to three questions each, every one with "I'd rather not say". The answers give the readings the
 * context of where the person is in life (houses 1, 4, 10, 7, 5, and what they care about); they land in
 * person_facts, which the boards and the chat read.
 */
import { useState } from 'react';
import { saveFacts } from '../../lib/profileApi';
import { track } from '../../lib/events';
import SelfieStep from './SelfieStep';

type Opt = { key: string; label: string };
type Question = { fact: string; text: string; options: Opt[]; multi?: number };
type Step = { id: string; title: string; questions: Question[] };

const DECLINE = '__declined__';

export const STEPS: Step[] = [
  { id: 'selfie', title: 'A photo of you', questions: [] },
  {
    id: 'place',
    title: 'Where you are',
    questions: [{ fact: 'place.current', text: 'Where do you live now?', options: [{ key: 'use_location', label: 'Use my location' }] }],
  },
  {
    id: 'work',
    title: 'Work',
    questions: [
      { fact: 'work.status', text: 'Do you have a job right now?', options: [{ key: 'yes', label: 'Yes' }, { key: 'between_jobs', label: 'Between jobs' }, { key: 'own_business', label: 'Own business' }, { key: 'studying', label: 'Studying' }, { key: 'retired', label: 'Retired' }] },
      {
        fact: 'work.level',
        text: 'What best describes your work?',
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
    questions: [{ fact: 'love.status', text: 'Right now are you…', options: [{ key: 'single', label: 'Single' }, { key: 'dating', label: 'Dating' }, { key: 'committed', label: 'In a relationship' }, { key: 'married', label: 'Married' }, { key: 'separated', label: 'Separated' }, { key: 'complicated', label: "It's complicated" }] }],
  },
  {
    id: 'family',
    title: 'Family',
    questions: [{ fact: 'family.children', text: 'Children?', options: [{ key: 'none', label: 'None' }, { key: 'expecting', label: 'Expecting' }, { key: 'young', label: 'Yes, young' }, { key: 'grown', label: 'Yes, grown' }] }],
  },
  {
    id: 'focus',
    title: 'What matters now',
    questions: [
      {
        fact: 'self.focus',
        text: 'What matters most to you now? Pick up to three.',
        multi: 3,
        options: ['career', 'money', 'love', 'family', 'home', 'learning', 'travel', 'health', 'creativity', 'spirituality'].map((k) => ({ key: k, label: k[0]!.toUpperCase() + k.slice(1) })),
      },
    ],
  },
];

const chip = 'min-h-[48px] rounded-xl border px-4 text-left';

export default function WelcomeWizard({ onFinish }: { onFinish: () => void }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [city, setCity] = useState('');
  const step = STEPS[i];

  const finish = async (how: 'done' | 'skipped') => {
    const today = new Date().toISOString().slice(0, 10);
    await saveFacts({ [`wizard.${how}`]: today }).catch(() => false);
    track('question_answer', 'welcome', how, { step: step?.id ?? 'end' });
    onFinish();
  };

  const next = async () => {
    if (!step) return;
    const facts: Record<string, string | null> = {};
    for (const q of step.questions) {
      const a = answers[q.fact];
      if (a === undefined) continue;
      facts[q.fact] = a === DECLINE ? null : a;
    }
    if (step.id === 'place' && city.trim() && answers['place.current'] === undefined) facts['place.current'] = city.trim();
    if (Object.keys(facts).length) await saveFacts(facts).catch(() => false);
    track('question_answer', 'welcome', step.id, { answered: Object.keys(facts).length });
    if (i + 1 >= STEPS.length) setI(STEPS.length);
    else setI(i + 1);
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

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-xl flex-col px-4 pb-16 pt-6 text-white" data-testid="welcome-wizard">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="text-sm text-white/60">{i < STEPS.length ? `Step ${i + 1} of ${STEPS.length}` : 'All set'}</div>
        {i < STEPS.length && (
          <button type="button" onClick={() => void finish('skipped')} className="min-h-[44px] text-sm text-white/70 underline underline-offset-4">
            Skip for now
          </button>
        )}
      </div>
      <div className="mb-6 h-1 w-full rounded bg-white/10">
        <div className="h-1 rounded bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${(Math.min(i, STEPS.length) / STEPS.length) * 100}%` }} />
      </div>

      {i === 0 && <SelfieStep onDone={() => setI(1)} onSkip={() => { void saveFacts({ 'wizard.selfie': 'skipped' }); setI(1); }} />}

      {i > 0 && step && (
        <div data-testid={`step-${step.id}`}>
          <h2 className="mb-4 text-2xl font-semibold">{step.title}</h2>
          {step.questions.map((q) => (
            <fieldset key={q.fact} className="mb-6">
              <legend className="mb-3 text-white/85">{q.text}</legend>
              {step.id === 'place' && (
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City, country"
                  aria-label="City, country"
                  className="mb-2 min-h-[48px] w-full rounded-xl border border-white/15 bg-white/5 px-4 text-white placeholder-white/40"
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
                      className={`${chip} ${selected ? 'border-purple-400 bg-white/15' : 'border-white/15 bg-white/5'}`}
                    >
                      {o.label}
                    </button>
                  );
                })}
                <button type="button" aria-pressed={answers[q.fact] === DECLINE} onClick={() => pick(q, DECLINE)} className={`${chip} ${answers[q.fact] === DECLINE ? 'border-purple-400 bg-white/15' : 'border-white/10 text-white/60'}`}>
                  I'd rather not say
                </button>
              </div>
            </fieldset>
          ))}
          <button type="button" onClick={() => void next()} className="mt-2 min-h-[48px] w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-medium">
            {i + 1 >= STEPS.length ? 'Finish' : 'Next'}
          </button>
        </div>
      )}

      {i >= STEPS.length && (
        <div data-testid="step-done">
          <h2 className="mb-2 text-2xl font-semibold">Thank you</h2>
          <p className="mb-6 text-white/75">Your readings will speak to where you are now.</p>
          <button type="button" onClick={() => void finish('done')} className="min-h-[48px] w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-medium">
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
