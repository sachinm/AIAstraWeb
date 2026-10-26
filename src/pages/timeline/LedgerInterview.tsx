import React, { useState } from 'react';
import {
  INTERVIEW_MAX_CHARS,
  runLedgerInterview,
  type LedgerMeta,
  type LedgerProposal,
  type LifeEventInput,
} from '../../lib/ledgerApi';
import LedgerEventForm from './LedgerEventForm';

interface Props {
  meta: LedgerMeta;
  /** POSTs one confirmed proposal (possibly edited). Throws LedgerApiError on 400 so the form can show it. */
  onConfirm: (input: LifeEventInput) => Promise<void>;
}

const inputCls =
  'w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-white placeholder-gray-500 focus:border-purple-400 focus:outline-none';

/**
 * Free-text interview: the server proposes dated events from what the person writes (nothing is stored).
 * Proposals are shown one at a time in the event form: Confirm saves it (after any edits), Skip drops it.
 */
const LedgerInterview: React.FC<Props> = ({ meta, onConfirm }) => {
  const [text, setText] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [queue, setQueue] = useState<LedgerProposal[]>([]);
  const [total, setTotal] = useState(0);
  const [doneNote, setDoneNote] = useState<string | null>(null);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) {
      setError('Write a few lines first.');
      return;
    }
    const y = year.trim() ? Number(year) : undefined;
    if (y !== undefined && (!Number.isInteger(y) || y < 1000 || y > new Date().getFullYear())) {
      setError('Enter a past year, e.g. 2014, or leave it empty.');
      return;
    }
    setBusy(true);
    setError(null);
    setReply(null);
    setDoneNote(null);
    setQueue([]);
    try {
      const r = await runLedgerInterview(t, y);
      if (r.declined) {
        setReply(r.declined.reply);
        setTotal(0);
        return;
      }
      setQueue(r.proposals);
      setTotal(r.proposals.length);
      if (r.proposals.length === 0) setDoneNote('No dated events were found in that text. You can add them with the form.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that text.');
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    const rest = queue.slice(1);
    setQueue(rest);
    if (rest.length === 0) setDoneNote('All proposed events have been gone through.');
  };

  const current = queue[0];

  return (
    <section aria-label="Interview" className="space-y-4">
      <form onSubmit={ask} className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Tell me what happened</h3>
        <label htmlFor="ledger-interview-text" className="sr-only">
          What happened
        </label>
        <textarea
          id="ledger-interview-text"
          rows={4}
          maxLength={INTERVIEW_MAX_CHARS}
          placeholder="Tell me what happened in a year, e.g. 2014"
          className={inputCls}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="ledger-interview-year" className="mb-1 block text-sm text-gray-300">
              Year (optional)
            </label>
            <input
              id="ledger-interview-year"
              type="number"
              inputMode="numeric"
              placeholder="2014"
              className={`${inputCls} w-28`}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {busy ? 'Reading…' : 'Find events'}
          </button>
          <span className="text-xs text-gray-500">
            {text.length}/{INTERVIEW_MAX_CHARS}
          </span>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
      </form>

      {reply && (
        <p className="whitespace-pre-wrap rounded-lg border border-white/15 bg-white/5 p-3 text-gray-200" data-testid="interview-reply">
          {reply}
        </p>
      )}

      {current && (
        <div className="rounded-lg border border-white/15 bg-white/5 p-3">
          <p className="mb-2 text-xs text-gray-400">
            Proposed event {total - queue.length + 1} of {total}. Check it, change anything, then confirm or skip.
          </p>
          <LedgerEventForm
            meta={meta}
            title="Proposed event"
            submitLabel="Confirm"
            cancelLabel="Skip"
            formKey={current.proposalId}
            initial={{
              category: current.category,
              date: current.date,
              date_precision: current.date_precision,
              place: current.place ?? '',
              attributes: current.attributes ?? {},
            }}
            onSubmit={async (input) => {
              await onConfirm(input);
              next();
            }}
            onCancel={next}
          />
        </div>
      )}

      {!current && doneNote && <p className="text-sm text-gray-400">{doneNote}</p>}
    </section>
  );
};

export default LedgerInterview;
