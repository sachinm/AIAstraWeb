import React, { useEffect, useId, useState } from 'react';
import {
  ATTRIBUTE_MAX_CHARS,
  LedgerApiError,
  type DatePrecision,
  type LedgerMeta,
  type LifeEventInput,
} from '../../lib/ledgerApi';
import { cleanAttributes, formFieldForServerField, isFutureDate, normaliseDate, toInputValue } from './ledgerUtils';

export interface LedgerDraft {
  category: string;
  date: string; // any of YYYY / YYYY-MM / YYYY-MM-DD
  date_precision: DatePrecision;
  place: string;
  attributes: Record<string, string>;
}

export const emptyDraft = (): LedgerDraft => ({ category: '', date: '', date_precision: 'day', place: '', attributes: {} });

interface Props {
  meta: LedgerMeta;
  title: string;
  submitLabel: string;
  initial: LedgerDraft;
  /** Changes when a different event/proposal is loaded, so the form resets. */
  formKey: string;
  onSubmit: (input: LifeEventInput) => Promise<void>;
  onCancel?: () => void;
  cancelLabel?: string;
}

const PRECISION_LABELS: Record<DatePrecision, string> = { day: 'Exact day', month: 'Month', year: 'Year only' };

const inputCls =
  'w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-white placeholder-gray-500 focus:border-purple-400 focus:outline-none';
const labelCls = 'mb-1 block text-sm text-gray-300';

const FieldError: React.FC<{ id: string; msg?: string }> = ({ id, msg }) =>
  msg ? (
    <p id={id} role="alert" className="mt-1 text-sm text-red-300">
      {msg}
    </p>
  ) : null;

const LedgerEventForm: React.FC<Props> = ({ meta, title, submitLabel, initial, formKey, onSubmit, onCancel, cancelLabel }) => {
  const [category, setCategory] = useState(initial.category);
  const [precision, setPrecision] = useState<DatePrecision>(initial.date_precision);
  const [dateValue, setDateValue] = useState(toInputValue(initial.date, initial.date_precision));
  const [place, setPlace] = useState(initial.place);
  const [attrs, setAttrs] = useState<Record<string, string>>(initial.attributes);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // the page can show two forms at once (edit + interview proposal), so ids are per instance
  const uid = useId().replace(/:/g, '');
  const fid = (name: string) => `ledger-${uid}-${name.replace(/[^a-z0-9]/gi, '-')}`;

  useEffect(() => {
    setCategory(initial.category);
    setPrecision(initial.date_precision);
    setDateValue(toInputValue(initial.date, initial.date_precision));
    setPlace(initial.place);
    setAttrs(initial.attributes);
    setErrors({});
    // reset only when a different record is loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);

  const precisions = meta.precisions?.length ? meta.precisions : (['day', 'month', 'year'] as DatePrecision[]);
  const attributeKeys = meta.attributes.map((a) => a.key);
  const now = new Date();
  const todayDay = toInputValue(`${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`, 'day');

  const changePrecision = (p: DatePrecision) => {
    setDateValue((v) => toInputValue(v, p));
    setPrecision(p);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!category) errs.category = 'Choose a category.';
    const date = normaliseDate(dateValue, precision);
    if (!date) errs.date = precision === 'year' ? 'Enter a year.' : precision === 'month' ? 'Enter a month and year.' : 'Enter a full date.';
    else if (isFutureDate(date, precision, now)) errs.date = 'The date cannot be in the future.';
    for (const a of meta.attributes) {
      if (!a.values && (attrs[a.key] ?? '').trim().length > ATTRIBUTE_MAX_CHARS) {
        errs[`attr:${a.key}`] = `At most ${ATTRIBUTE_MAX_CHARS} characters.`;
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length || !date) return;

    setSaving(true);
    try {
      await onSubmit({
        category,
        date,
        date_precision: precision,
        place: place.trim() || null,
        attributes: cleanAttributes(attrs),
      });
    } catch (err) {
      if (err instanceof LedgerApiError && err.status === 400) {
        const key = formFieldForServerField(err.field, attributeKeys) ?? 'form';
        setErrors({ [key]: err.message });
      } else {
        setErrors({ form: err instanceof Error ? err.message : 'Could not save.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const describedBy = (k: string) => (errors[k] ? fid(`err-${k}`) : undefined);

  return (
    <form onSubmit={submit} className="space-y-4" aria-label={title} noValidate>
      <h3 className="text-lg font-semibold text-white">{title}</h3>

      <div>
        <label htmlFor={fid('category')} className={labelCls}>
          Category
        </label>
        <select
          id={fid('category')}
          className={inputCls}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-invalid={!!errors.category}
          aria-describedby={describedBy('category')}
        >
          <option value="">Choose…</option>
          {meta.markers.map((m) => (
            <optgroup key={m.id} label={m.label}>
              {m.categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <FieldError id={fid('err-category')} msg={errors.category} />
      </div>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div>
          <label htmlFor={fid('precision')} className={labelCls}>
            How exact is the date?
          </label>
          <select
            id={fid('precision')}
            className={inputCls}
            value={precision}
            onChange={(e) => changePrecision(e.target.value as DatePrecision)}
          >
            {precisions.map((p) => (
              <option key={p} value={p}>
                {PRECISION_LABELS[p] ?? p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={fid('date')} className={labelCls}>
            {precision === 'year' ? 'Year' : precision === 'month' ? 'Month' : 'Date'}
          </label>
          {precision === 'year' ? (
            <input
              id={fid('date')}
              type="number"
              inputMode="numeric"
              min={1900}
              max={now.getFullYear()}
              placeholder="e.g. 2014"
              className={inputCls}
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              aria-invalid={!!errors.date}
              aria-describedby={describedBy('date')}
            />
          ) : precision === 'month' ? (
            <input
              id={fid('date')}
              type="month"
              placeholder="YYYY-MM"
              max={todayDay.slice(0, 7)}
              className={inputCls}
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              aria-invalid={!!errors.date}
              aria-describedby={describedBy('date')}
            />
          ) : (
            <input
              id={fid('date')}
              type="date"
              max={todayDay}
              className={inputCls}
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              aria-invalid={!!errors.date}
              aria-describedby={describedBy('date')}
            />
          )}
          <FieldError id={fid('err-date')} msg={errors.date} />
        </div>
      </div>

      <div>
        <label htmlFor={fid('place')} className={labelCls}>
          Place (optional)
        </label>
        <input
          id={fid('place')}
          type="text"
          className={inputCls}
          value={place}
          maxLength={120}
          onChange={(e) => setPlace(e.target.value)}
          aria-invalid={!!errors.place}
          aria-describedby={describedBy('place')}
        />
        <FieldError id={fid('err-place')} msg={errors.place} />
      </div>

      {meta.attributes.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {meta.attributes.map((a) => {
            const k = `attr:${a.key}`;
            const id = fid(`attr-${a.key}`);
            const value = attrs[a.key] ?? '';
            const set = (v: string) => setAttrs((prev) => ({ ...prev, [a.key]: v }));
            return (
              <div key={a.key}>
                <label htmlFor={id} className={labelCls}>
                  {a.label} (optional)
                </label>
                {a.values ? (
                  <select id={id} className={inputCls} value={value} onChange={(e) => set(e.target.value)} aria-invalid={!!errors[k]} aria-describedby={describedBy(k)}>
                    <option value="">—</option>
                    {a.values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    type="text"
                    className={inputCls}
                    value={value}
                    maxLength={ATTRIBUTE_MAX_CHARS}
                    onChange={(e) => set(e.target.value)}
                    aria-invalid={!!errors[k]}
                    aria-describedby={describedBy(k)}
                  />
                )}
                <FieldError id={fid(`err-${k}`)} msg={errors[k]} />
              </div>
            );
          })}
        </div>
      )}
      <FieldError id={fid('err-attributes')} msg={errors.attributes} />
      <FieldError id={fid('err-form')} msg={errors.form} />

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/20 px-4 py-2 text-gray-200 hover:bg-white/10"
          >
            {cancelLabel ?? 'Cancel'}
          </button>
        )}
      </div>
    </form>
  );
};

export default LedgerEventForm;
