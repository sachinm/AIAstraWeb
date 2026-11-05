import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';
import { completeProfile, fetchMe, isChartOpen, type ChartStatus, type Gender, type Language } from './api';
import ChartProgress from '../components/ChartProgress';
import BirthFields, {
  BIRTH_FIELD_LABEL,
  BIRTH_FIELD_ORDER,
  EMPTY_BIRTH,
  to24Hour,
  validateBirth,
  type BirthErrors,
  type BirthField,
  type BirthFieldsHandle,
  type BirthValues,
} from './fields/BirthFields';
import { defaultCountryFromLocale } from './fields/countries';
import LanguageField, { defaultLanguage } from './fields/LanguageField';
import { parseTypedDate } from './fields/dateUtils';
import { READY_NOTICE } from './readyNotice';
import { clearSignupDraft, readSignupDraft, readSignupStep, saveSignupDraft, saveSignupStep } from './signupDraft';

export { to24Hour };

interface Props {
  /** Called once the profile is saved (or was already complete): go to the app. */
  onDone: () => void;
}

type Values = BirthValues & { referral: string; language?: Language };

const EMPTY: Values = { ...EMPTY_BIRTH, referral: '' };

/** What a step can hold: the birth fields, plus the language choice and the referral code. */
type StepPart = BirthField | 'language' | 'referral';
interface Step {
  title: string;
  parts: StepPart[];
}

/**
 * Small steps, so the page never needs a scroll bar (docs/product/birth-details-three-steps.md, server repo): three on a
 * normal window, and one question at a time on a short one (a small laptop window, a phone on its side).
 */
const STEPS: Step[] = [
  { title: 'When were you born?', parts: ['dob', 'time'] },
  { title: 'Where were you born?', parts: ['country', 'city'] },
  { title: 'A little about you', parts: ['gender', 'language', 'referral'] },
];
const SHORT_STEPS: Step[] = [
  { title: 'When were you born?', parts: ['dob'] },
  { title: 'What time were you born?', parts: ['time'] },
  { title: 'Which country were you born in?', parts: ['country'] },
  { title: 'Which city were you born in?', parts: ['city'] },
  { title: 'A little about you', parts: ['gender'] },
  { title: 'Your language', parts: ['language'] },
  { title: 'Referral code', parts: ['referral'] },
];
const SHORT_QUERY = '(max-height: 599px)';

function subscribeShort(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(SHORT_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
const isShort = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(SHORT_QUERY).matches);

const birthParts = (st: Step) => st.parts.filter((x): x is BirthField => x !== 'language' && x !== 'referral');

/** The step is kept by its first part, so it survives a switch between the two layouts. */
function loadStepPart(): StepPart {
  const v = readSignupStep();
  if (v && SHORT_STEPS.some((st) => st.parts[0] === v)) return v as StepPart;
  return 'dob';
}

/** The draft and the step live in memory only (signupDraft.ts): never in sessionStorage or localStorage. */
function loadDraft(): Values {
  return { ...EMPTY, ...(readSignupDraft<Values>() ?? {}) };
}

const input =
  'w-full bg-white/10 border rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent';
const label = 'block text-sm font-medium text-gray-300 mb-2';

const BirthDetails: React.FC<Props> = ({ onDone }) => {
  const [values, setValues] = useState<Values>(() => {
    const v = loadDraft();
    return { ...v, country: v.country || defaultCountryFromLocale(), language: v.language ?? defaultLanguage() };
  });
  const [errors, setErrors] = useState<BirthErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [chart, setChart] = useState<ChartStatus | null>(null);
  const short = useSyncExternalStore(subscribeShort, isShort, () => false);
  const steps = short ? SHORT_STEPS : STEPS;
  const last = steps.length - 1;
  // the step is kept as the part it starts with, so turning a phone or resizing keeps the person's place
  const [stepPart, setStepPart] = useState<StepPart>(loadStepPart);
  const found = steps.findIndex((st) => st.parts.includes(stepPart));
  const step = found < 0 ? 0 : found;
  const setStep = (i: number) => setStepPart(steps[Math.max(0, Math.min(last, i))].parts[0]);

  const fieldsRef = useRef<BirthFieldsHandle>(null);

  // A user who already finished registration and whose chat is open does not need this page.
  // If their birth details were already submitted (e.g. before a page reload or logout + login) and their
  // birth chart is still being generated, show the generating overlay and poll until chat opens, then proceed
  // to the dashboard.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const checkMe = async () => {
      const me = await fetchMe();
      if (!alive || !me?.profile_complete) return;
      if (isChartOpen(me)) {
        setLoading(false);
        onDone();
        return;
      }
      setChart(me.chart ?? null);
      setLoading(true);
      timer = setTimeout(() => {
        void checkMe();
      }, 2000);
    };

    void checkMe();
    return () => {
      alive = false;
      if (timer !== undefined) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the entries in memory while the user moves between the sign-up pages; a refresh loses them.
  useEffect(() => {
    saveSignupDraft(values);
    saveSignupStep(stepPart);
  }, [values, stepPart]);

  /** Checks the given fields; names and focuses what is missing. True when they are all fine. */
  const checkFields = (fields: BirthField[]): boolean => {
    const found = validateBirth(values);
    const bad = BIRTH_FIELD_ORDER.filter((f) => fields.includes(f) && found[f]);
    setErrors((p) => ({ ...p, ...Object.fromEntries(fields.map((f) => [f, found[f] ?? ''])) }));
    if (bad.length === 0) {
      setSummary('');
      return true;
    }
    setSummary(`Still needed: ${bad.map((f) => BIRTH_FIELD_LABEL[f]).join(', ')}.`);
    setStep(steps.findIndex((st) => st.parts.includes(bad[0])));
    // the field is drawn on the next render when the step changes
    setTimeout(() => fieldsRef.current?.focus(bad[0]), 0);
    return false;
  };

  const goBack = () => {
    setSummary('');
    setStep(step - 1);
  };

  const checkField = (f: BirthField, v: BirthValues = values) => {
    const msg = validateBirth(v)[f] ?? '';
    setErrors((p) => ({ ...p, [f]: msg }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setSubmitError('');
    if (step < last) {
      if (checkFields(birthParts(steps[step]))) setStep(step + 1);
      return;
    }
    // the last step checks everything, and goes back to the first step with a gap
    if (!checkFields(BIRTH_FIELD_ORDER)) return;
    setLoading(true);
    try {
      const result = await completeProfile({
        date_of_birth: parseTypedDate(values.dob) as string,
        time_of_birth: to24Hour(values.hour, values.minute, values.ampm),
        country_code: values.country,
        city: values.city.trim(),
        gender: values.gender as Gender,
        referral_code: values.referral.trim() || null,
        language: values.language ?? 'en',
      });
      if (result.success) {
        clearSignupDraft();
        // Poll until chat opens (or if fetchMe is unavailable, proceed immediately).
        for (let attempt = 0; attempt < 30; attempt++) {
          const me = await fetchMe();
          if (!me || isChartOpen(me) || !me.profile_complete) break;
          setChart(me.chart ?? null);
          await new Promise((r) => setTimeout(r, 2000));
        }
        setLoading(false);
        onDone();
      } else {
        setLoading(false);
        setSubmitError(result.message || 'Something went wrong on our side. Your details are still here; try again in a moment.');
      }
    } catch {
      setLoading(false);
      setSubmitError('Something went wrong on our side. Your details are still here; try again in a moment.');
    }
  };

  return (
    <div className="auth-shell min-h-full flex items-start justify-center px-4 pb-3 sm:px-6 [@media(max-height:480px)]:pb-1">
      {loading && (
        <div
          role="status"
          aria-live="polite"
          data-test-id="birth-chart-generating-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-slate-900/95 border border-purple-400/30 p-8 text-center shadow-2xl">
            {chart ? (
              <ChartProgress chart={chart} onUpdated={setChart} />
            ) : (
              <>
                <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/20 border border-purple-400/40">
                  <Loader2 className="h-9 w-9 text-purple-400 animate-spin" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Generating your birth chart…
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  We are calculating your planetary placements, divisional charts, and dasha periods. Please wait a moment while we prepare your profile.
                </p>
              </>
            )}
            <p role="note" className="mt-5 rounded-lg border border-purple-400/30 bg-purple-500/15 px-4 py-3 text-left text-sm text-purple-100">
              {READY_NOTICE}
            </p>
          </div>
        </div>
      )}
      <div className="w-full max-w-md">
        <div className="bg-slate-950/35 backdrop-blur-[3px] rounded-2xl p-5 sm:p-6 [@media(max-height:480px)]:p-3 border border-white/20 shadow-2xl">
          <div className="text-center mb-3">
            <h2 className="text-xl font-bold text-white [@media(max-height:480px)]:sr-only">Your birth details</h2>
            <p className="mt-0.5 text-gray-200" data-test-id="details-step-title">{steps[step].title}</p>
            <div className="mt-1.5 flex items-center justify-center gap-1.5" data-test-id="details-step">
              {steps.map((st, i) => (
                <span key={st.title} className={`h-1.5 ${short ? 'w-4' : 'w-8'} rounded-full ${i <= step ? 'bg-purple-400' : 'bg-white/20'}`} aria-hidden="true" />
              ))}
              <span className="ml-1 text-xs text-gray-400">
                Step {step + 1} of {steps.length}
              </span>
            </div>
          </div>

          <form onSubmit={submit} noValidate className="space-y-3 [@media(max-height:480px)]:space-y-2">
            <BirthFields
              ref={fieldsRef}
              values={values}
              errors={errors}
              onChange={(patch) => setValues((p) => ({ ...p, ...patch }))}
              onCheck={checkField}
              only={birthParts(steps[step])}
            />

            {steps[step].parts.includes('language') && (
              <LanguageField value={values.language ?? 'en'} onChange={(language) => setValues((p) => ({ ...p, language }))} />
            )}

            {steps[step].parts.includes('referral') && (
            <div>
              <label htmlFor="referral" className={label}>
                Referral code (optional)
              </label>
              <input
                id="referral"
                type="text"
                value={values.referral}
                onChange={(e) => setValues((p) => ({ ...p, referral: e.target.value }))}
                autoComplete="off"
                className={`${input} border-white/20`}
              />
            </div>
            )}

            {summary && (
              <div role="alert" className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
                {summary}
              </div>
            )}
            {submitError && (
              <div role="alert" className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
                {submitError}
              </div>
            )}

            <div className="flex gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="rounded-lg border border-white/20 px-5 py-2.5 font-semibold text-gray-200 hover:bg-white/10"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              aria-busy={loading}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2.5 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 flex justify-center items-center"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating your chart…
                </>
              ) : step < last ? (
                'Next'
              ) : (
                'Create my chart'
              )}
            </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BirthDetails;
