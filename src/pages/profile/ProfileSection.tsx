import React, { useEffect, useRef, useState } from 'react';
import { fetchProfile, updateProfile, type Gender } from '../../Auth/api';
import BirthFields, {
  BIRTH_FIELD_LABEL,
  BIRTH_FIELD_ORDER,
  EMPTY_BIRTH,
  from24Hour,
  to24Hour,
  validateBirth,
  type BirthErrors,
  type BirthField,
  type BirthFieldsHandle,
  type BirthValues,
} from '../../Auth/fields/BirthFields';
import { isoToTyped, parseTypedDate } from '../../Auth/fields/dateUtils';
import { useRefreshMe } from '../../Auth/ProfileGate';
import { READY_NOTICE } from '../../Auth/readyNotice';
import LedgerSection from '../timeline/LedgerSection';

export const REBUILD_WARNING =
  'Changing your birth details rebuilds your chart. Readings will use the new chart in about 30 minutes.';

const panelCls = 'rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:p-6';

interface Payload {
  name: string;
  gender: Gender;
  date_of_birth: string;
  time_of_birth: string;
  country_code: string;
  city: string;
}

function payloadOf(name: string, v: BirthValues): Payload {
  return {
    name: name.trim(),
    gender: v.gender as Gender,
    date_of_birth: parseTypedDate(v.dob) as string,
    time_of_birth: to24Hour(v.hour, v.minute, v.ampm),
    country_code: v.country,
    city: v.city.trim(),
  };
}

const birthChanged = (a: Payload, b: Payload) =>
  a.date_of_birth !== b.date_of_birth ||
  a.time_of_birth !== b.time_of_birth ||
  a.country_code !== b.country_code ||
  a.city !== b.city;

/** Profile page: name and birth details (same controls as registration page 2), then the life timeline. */
const ProfileSection: React.FC = () => {
  const timelineEnabled = import.meta.env.VITE_TIMELINE_ENABLED === 'true';
  const refreshMe = useRefreshMe();
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [values, setValues] = useState<BirthValues>({ ...EMPTY_BIRTH });
  const [errors, setErrors] = useState<BirthErrors>({});
  const [saved, setSaved] = useState<Payload | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [rebuild, setRebuild] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const fieldsRef = useRef<BirthFieldsHandle>(null);

  useEffect(() => {
    let alive = true;
    void fetchProfile().then((p) => {
      if (!alive) return;
      if (!p) {
        setLoadFailed(true);
        return;
      }
      const v: BirthValues = {
        dob: p.date_of_birth ? isoToTyped(p.date_of_birth.slice(0, 10)) : '',
        ...from24Hour(p.time_of_birth),
        country: p.country_code ?? '',
        city: p.city ?? '',
        gender: p.gender ?? '',
      };
      setName(p.name ?? '');
      setValues(v);
      if (Object.keys(validateBirth(v)).length === 0) setSaved(payloadOf(p.name ?? '', v));
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const checkField = (f: BirthField, v: BirthValues = values) =>
    setErrors((p) => ({ ...p, [f]: validateBirth(v)[f] ?? '' }));

  const doSave = async (payload: Payload, changedBirth: boolean) => {
    setSaving(true);
    setError('');
    try {
      const r = await updateProfile(payload);
      if (r.success) {
        setSaved(payload);
        setConfirming(false);
        setRebuild(changedBirth);
        setMessage(changedBirth ? 'Saved. Your chart is being rebuilt.' : 'Saved.');
        if (changedBirth) await refreshMe();
      } else {
        setConfirming(false);
        setError(r.message || 'Something went wrong on our side. Your changes are still here; try again in a moment.');
      }
    } finally {
      setSaving(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setMessage('');
    setError('');
    const found = validateBirth(values);
    const nameBad = name.trim().length < 2;
    setNameError(nameBad ? 'Enter your name.' : '');
    setErrors(found);
    const bad = BIRTH_FIELD_ORDER.filter((f) => found[f]);
    if (nameBad || bad.length > 0) {
      setSummary(`Still needed: ${[...(nameBad ? ['Name'] : []), ...bad.map((f) => BIRTH_FIELD_LABEL[f])].join(', ')}.`);
      if (nameBad) nameRef.current?.focus();
      else fieldsRef.current?.focus(bad[0]);
      return;
    }
    setSummary('');
    const payload = payloadOf(name, values);
    const changedBirth = saved ? birthChanged(saved, payload) : false;
    if (changedBirth && !confirming) {
      setConfirming(true);
      return;
    }
    await doSave(payload, changedBirth);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 text-white sm:p-6">
      <header>
        <h2 className="text-2xl font-semibold">Profile</h2>
        <p className="mt-1 text-sm text-gray-300">Your name and the birth details your chart is built from.</p>
      </header>

      {loadFailed && (
        <p role="alert" className="text-sm text-red-300">
          Could not load your profile. Refresh the page to try again.
        </p>
      )}

      {rebuild && (
        <div role="status" className="rounded-lg border border-purple-400/30 bg-purple-500/15 px-4 py-3 text-sm text-purple-100">
          {READY_NOTICE}
        </div>
      )}

      {loaded && (
        <section className={panelCls} aria-label="Your details">
          <form onSubmit={submit} noValidate className="space-y-6">
            <div>
              <label htmlFor="profile-name" className="block text-sm font-medium text-gray-300 mb-2">
                Name
              </label>
              <input
                ref={nameRef}
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setMessage('');
                }}
                autoComplete="name"
                aria-invalid={Boolean(nameError)}
                className={`w-full bg-white/10 border ${nameError ? 'border-red-500' : 'border-white/20'} rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
              />
              {nameError && <p className="text-red-300 text-sm mt-1">{nameError}</p>}
            </div>

            <BirthFields
              ref={fieldsRef}
              values={values}
              errors={errors}
              onChange={(patch) => {
                setValues((p) => ({ ...p, ...patch }));
                setConfirming(false);
                setMessage('');
              }}
              onCheck={checkField}
            />

            {confirming && (
              <div role="alert" className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
                <p>{REBUILD_WARNING}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 font-semibold text-white"
                  >
                    Save and rebuild chart
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="rounded-lg border border-white/20 px-4 py-2 text-gray-200 hover:bg-white/10"
                  >
                    Keep editing
                  </button>
                </div>
              </div>
            )}

            {summary && (
              <div role="alert" className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
                {summary}
              </div>
            )}
            {error && (
              <div role="alert" className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            {message && (
              <p className="text-sm text-emerald-200" aria-live="polite">
                {message}
              </p>
            )}

            {!confirming && (
              <button
                type="submit"
                aria-busy={saving}
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </form>
        </section>
      )}

      <section aria-label="Your life timeline" className="space-y-4">
        <h3 className="text-xl font-semibold">Your life timeline</h3>
        {timelineEnabled && (
          <div className={panelCls}>
            <p className="text-sm text-gray-300">Coming soon — we&apos;re researching this</p>
          </div>
        )}
        <LedgerSection embedded />
      </section>
    </div>
  );
};

export default ProfileSection;
