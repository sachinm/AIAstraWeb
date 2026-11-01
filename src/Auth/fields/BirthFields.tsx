import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Clock } from 'lucide-react';
import type { Gender } from '../api';
import BirthDateField from './BirthDateField';
import CountrySelect from './CountrySelect';
import { dateError } from './dateUtils';

/** Birth-detail entries as typed. Shared by the registration page 2 and the Profile page. */
export interface BirthValues {
  dob: string; // typed DD/MM/YYYY
  hour: string; // '1'..'12' or ''
  minute: string; // '00'..'59' or ''
  ampm: '' | 'AM' | 'PM';
  country: string; // alpha-2
  city: string;
  gender: '' | Gender;
}

export type BirthField = 'dob' | 'time' | 'country' | 'city' | 'gender';
export type BirthErrors = Partial<Record<BirthField, string>>;

export const EMPTY_BIRTH: BirthValues = { dob: '', hour: '', minute: '', ampm: '', country: '', city: '', gender: '' };

export const BIRTH_FIELD_ORDER: BirthField[] = ['dob', 'time', 'country', 'city', 'gender'];
export const BIRTH_FIELD_LABEL: Record<BirthField, string> = {
  dob: 'Date of birth',
  time: 'Time of birth',
  country: 'Country',
  city: 'City',
  gender: 'Gender',
};

/** 12-hour pieces to the server's HH:MM (24-hour). 12 AM is 00:00, 12 PM is 12:00. */
export function to24Hour(hour: string, minute: string, ampm: string): string {
  let h = Number(hour) % 12;
  if (ampm === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

/** Server HH:MM (or HH:MM:SS) to the 12-hour pieces. Empty pieces when it cannot be read. */
export function from24Hour(time: string | null | undefined): Pick<BirthValues, 'hour' | 'minute' | 'ampm'> {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  if (!m) return { hour: '', minute: '', ampm: '' };
  const h24 = Number(m[1]);
  return { hour: String(h24 % 12 === 0 ? 12 : h24 % 12), minute: m[2], ampm: h24 >= 12 ? 'PM' : 'AM' };
}

export function validateBirth(v: BirthValues): BirthErrors {
  const e: BirthErrors = {};
  const d = dateError(v.dob);
  if (d) e.dob = d;
  if (!v.hour || !v.minute || !v.ampm) e.time = 'Choose the hour, minute and AM or PM.';
  if (!v.country) e.country = 'Choose your country of birth.';
  if (!v.city.trim()) e.city = 'Enter your city or town of birth.';
  if (!v.gender) e.gender = 'Choose one option.';
  return e;
}

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const input =
  'w-full bg-white/10 border rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent';
const label = 'block text-sm font-medium text-gray-300 mb-2';
const errCls = 'text-red-300 text-sm mt-1';
const hint = 'text-gray-400 text-sm mt-1';

export interface BirthFieldsHandle {
  focus: (field: BirthField) => void;
}

interface Props {
  values: BirthValues;
  errors: BirthErrors;
  onChange: (patch: Partial<BirthValues>) => void;
  /** Validate one field (on blur, or on change once it has an error). `next` is the values after the change. */
  onCheck: (field: BirthField, next?: BirthValues) => void;
}

const BirthFields = forwardRef<BirthFieldsHandle, Props>(function BirthFields({ values, errors, onChange, onCheck }, handle) {
  const dobRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLSelectElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const genderRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(handle, () => ({
    focus: (f) => {
      ({ dob: dobRef, time: hourRef, country: countryRef, city: cityRef, gender: genderRef })[f].current?.focus();
    },
  }));

  const border = (f: BirthField) => (errors[f] ? 'border-red-500' : 'border-white/20');
  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <>
      <div>
        <label htmlFor="dob" className={label}>
          Date of birth (DD/MM/YYYY)
        </label>
        <BirthDateField
          ref={dobRef}
          id="dob"
          text={values.dob}
          onTextChange={(t) => {
            onChange({ dob: t });
            if (errors.dob) onCheck('dob', { ...values, dob: t });
          }}
          onBlur={() => onCheck('dob')}
          error={errors.dob}
          describedBy="dob-help"
        />
        <p id="dob-help" className={errors.dob ? errCls : hint}>
          {errors.dob || 'Type it as day / month / year, or use the calendar.'}
        </p>
      </div>

      <fieldset>
        <legend className={label}>Time of birth</legend>
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
          <select
            ref={hourRef}
            aria-label="Hour"
            value={values.hour}
            onChange={(e) => onChange({ hour: e.target.value })}
            onBlur={() => onCheck('time')}
            className={`${input} ${border('time')} px-3`}
          >
            <option value="">Hour</option>
            {hours.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <span className="text-gray-300">:</span>
          <select
            aria-label="Minute"
            value={values.minute}
            onChange={(e) => onChange({ minute: e.target.value })}
            onBlur={() => onCheck('time')}
            className={`${input} ${border('time')} px-3`}
          >
            <option value="">Min</option>
            {minutes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            aria-label="AM or PM"
            value={values.ampm}
            onChange={(e) => onChange({ ampm: e.target.value as BirthValues['ampm'] })}
            onBlur={() => onCheck('time')}
            className={`${input} ${border('time')} px-3`}
          >
            <option value="">AM/PM</option>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
        <p className={errors.time ? errCls : hint}>
          {errors.time || "If you don't know the exact time, use your best estimate."}
        </p>
      </fieldset>

      <div>
        <label htmlFor="country" className={label}>
          Country of birth
        </label>
        <CountrySelect
          ref={countryRef}
          id="country"
          value={values.country}
          onChange={(c) => {
            onChange({ country: c });
            if (errors.country) onCheck('country', { ...values, country: c });
          }}
          onBlur={() => onCheck('country')}
          error={errors.country}
          describedBy="country-help"
        />
        {errors.country && (
          <p id="country-help" className={errCls}>
            {errors.country}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="city" className={label}>
          City of birth
        </label>
        <input
          ref={cityRef}
          id="city"
          type="text"
          value={values.city}
          onChange={(e) => onChange({ city: e.target.value })}
          onBlur={() => onCheck('city')}
          placeholder="For example Pune"
          autoComplete="off"
          aria-invalid={Boolean(errors.city)}
          className={`${input} ${border('city')}`}
        />
        {errors.city && <p className={errCls}>{errors.city}</p>}
      </div>

      <fieldset>
        <legend className={label}>Gender</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {GENDERS.map((g, i) => (
            <label
              key={g.value}
              className={`flex items-center gap-2 rounded-lg border px-3 py-3 text-white cursor-pointer ${
                values.gender === g.value ? 'border-purple-400 bg-purple-500/20' : border('gender') + ' bg-white/10'
              }`}
            >
              <input
                ref={i === 0 ? genderRef : undefined}
                type="radio"
                name="gender"
                value={g.value}
                checked={values.gender === g.value}
                onChange={() => {
                  onChange({ gender: g.value });
                  if (errors.gender) onCheck('gender', { ...values, gender: g.value });
                }}
                className="accent-purple-500"
              />
              <span className="text-sm">{g.label}</span>
            </label>
          ))}
        </div>
        {errors.gender && <p className={errCls}>{errors.gender}</p>}
      </fieldset>
    </>
  );
});

export default BirthFields;
