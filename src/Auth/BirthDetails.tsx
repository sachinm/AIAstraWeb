import React, { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { completeProfile, fetchMe, type Gender } from './api';
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
import { parseTypedDate } from './fields/dateUtils';
import { READY_NOTICE } from './readyNotice';

export { to24Hour };

interface Props {
  /** Called once the profile is saved (or was already complete): go to the app. */
  onDone: () => void;
}

type Values = BirthValues & { referral: string };

const STORAGE_KEY = 'aiastra.registration.details';
const EMPTY: Values = { ...EMPTY_BIRTH, referral: '' };

function loadDraft(): Values {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<Values>) };
  } catch {
    /* storage unavailable: start empty */
  }
  return { ...EMPTY };
}

const input =
  'w-full bg-white/10 border rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent';
const label = 'block text-sm font-medium text-gray-300 mb-2';

const BirthDetails: React.FC<Props> = ({ onDone }) => {
  const [values, setValues] = useState<Values>(() => {
    const v = loadDraft();
    return v.country ? v : { ...v, country: defaultCountryFromLocale() };
  });
  const [errors, setErrors] = useState<BirthErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const fieldsRef = useRef<BirthFieldsHandle>(null);

  // A user who already finished registration does not need this page.
  useEffect(() => {
    let alive = true;
    void fetchMe().then((me) => {
      if (alive && me?.profile_complete) onDone();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave, so a refresh does not lose the entries.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
      /* storage unavailable: nothing to save to */
    }
  }, [values]);

  const checkField = (f: BirthField, v: BirthValues = values) => {
    const msg = validateBirth(v)[f] ?? '';
    setErrors((p) => ({ ...p, [f]: msg }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setSubmitError('');
    const found = validateBirth(values);
    setErrors(found);
    const bad = BIRTH_FIELD_ORDER.filter((f) => found[f]);
    if (bad.length > 0) {
      setSummary(`Still needed: ${bad.map((f) => BIRTH_FIELD_LABEL[f]).join(', ')}.`);
      fieldsRef.current?.focus(bad[0]);
      return;
    }
    setSummary('');
    setLoading(true);
    try {
      const result = await completeProfile({
        date_of_birth: parseTypedDate(values.dob) as string,
        time_of_birth: to24Hour(values.hour, values.minute, values.ampm),
        country_code: values.country,
        city: values.city.trim(),
        gender: values.gender as Gender,
        referral_code: values.referral.trim() || null,
      });
      if (result.success) {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        onDone();
      } else {
        setSubmitError(result.message || 'Something went wrong on our side. Your details are still here; try again in a moment.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-white/20 shadow-2xl">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <Star className="w-12 h-12 text-purple-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Your birth details</h2>
            <p className="text-gray-300">We use these to calculate your chart.</p>
          </div>

          <div role="note" className="bg-purple-500/15 border border-purple-400/30 text-purple-100 px-4 py-3 rounded-lg mb-6 text-sm">
            {READY_NOTICE}
          </div>

          <form onSubmit={submit} noValidate className="space-y-6">
            <BirthFields
              ref={fieldsRef}
              values={values}
              errors={errors}
              onChange={(patch) => setValues((p) => ({ ...p, ...patch }))}
              onCheck={checkField}
            />

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

            <button
              type="submit"
              aria-busy={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 flex justify-center items-center"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating your chart…
                </>
              ) : (
                'Create my chart'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BirthDetails;
