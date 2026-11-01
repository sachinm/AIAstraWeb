import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import {
  createLedgerEvent,
  deleteLedgerEvent,
  fetchLedgerEvents,
  updateLedgerEvent,
  type LifeEvent,
  type LifeEventInput,
} from '../../lib/ledgerApi';
import LedgerEventForm, { emptyDraft } from './LedgerEventForm';
import LedgerInterview from './LedgerInterview';
import LedgerYearStrip from './LedgerYearStrip';
import { categoryLabel, categoryLabels, formatEventDate, stripYears } from './ledgerUtils';
import { useLedgerMeta } from './useLedgerMeta';

const byDate = (a: LifeEvent, b: LifeEvent) => a.date.localeCompare(b.date);

const panelCls = 'rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:p-6';

/**
 * Life-event ledger (timeline P0): the person's own dated life events as plain facts.
 * Hidden (redirects to chat) when the server reports the feature is off (meta 404).
 */
interface LedgerSectionProps {
  /** Inside the Profile page: no redirect when the feature is off (render nothing) and a smaller heading. */
  embedded?: boolean;
}

const LedgerSection: React.FC<LedgerSectionProps> = ({ embedded = false }) => {
  const { meta, loading: metaLoading } = useLedgerMeta();
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<LifeEvent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const labels = useMemo(() => categoryLabels(meta), [meta]);
  const years = useMemo(() => stripYears(new Date(), meta?.years ?? 18), [meta]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setEvents((await fetchLedgerEvents()).slice().sort(byDate));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (meta) void load();
  }, [meta, load]);

  const upsertLocal = (ev: LifeEvent) =>
    setEvents((prev) => [...prev.filter((p) => p.id !== ev.id), ev].sort(byDate));

  const create = async (input: LifeEventInput) => {
    const ev = await createLedgerEvent(input);
    upsertLocal(ev);
    setNotice(`Saved: ${categoryLabel(labels, ev.category)}, ${formatEventDate(ev.date, ev.date_precision)}.`);
  };

  const save = async (input: LifeEventInput) => {
    if (editing) {
      const ev = await updateLedgerEvent(editing.id, input);
      upsertLocal(ev);
      setEditing(null);
      setNotice(`Updated: ${categoryLabel(labels, ev.category)}, ${formatEventDate(ev.date, ev.date_precision)}.`);
    } else {
      await create(input);
    }
  };

  const startEdit = (ev: LifeEvent) => {
    setEditing(ev);
    setNotice(null);
    formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const remove = async (ev: LifeEvent) => {
    const label = `${categoryLabel(labels, ev.category)}, ${formatEventDate(ev.date, ev.date_precision)}`;
    if (!window.confirm(`Delete this event (${label})?`)) return;
    try {
      await deleteLedgerEvent(ev.id);
      setEvents((prev) => prev.filter((p) => p.id !== ev.id));
      if (editing?.id === ev.id) setEditing(null);
      setNotice(`Deleted: ${label}.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not delete.');
    }
  };

  if (metaLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-purple-300" aria-label="Loading" />
      </div>
    );
  }
  if (!meta) return embedded ? null : <Navigate to="/dashboard/chat" replace />;

  return (
    <div className={embedded ? 'w-full space-y-6 text-white' : 'mx-auto w-full max-w-7xl space-y-6 p-4 text-white sm:p-6'}>
      <header>
        {embedded ? (
          <h3 className="text-xl font-semibold">Life events</h3>
        ) : (
          <h2 className="text-2xl font-semibold">Life events</h2>
        )}
        <p className="mt-1 text-sm text-gray-300">
          A dated list of things that happened in your life. Add them one by one, or describe a year in your own words.
        </p>
      </header>

      <section className={panelCls} aria-label="Years">
        <h3 className="mb-3 text-lg font-semibold">
          {years[0]}–{years[years.length - 1]}
        </h3>
        {loading ? (
          <p className="text-sm text-gray-400">Loading events…</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-red-300">
            {loadError}{' '}
            <button type="button" className="underline" onClick={() => void load()}>
              Try again
            </button>
          </p>
        ) : (
          <LedgerYearStrip events={events} years={years} labels={labels} selectedId={editing?.id} onSelect={startEdit} />
        )}
      </section>

      {notice && (
        <p className="text-sm text-gray-200" role="status">
          {notice}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div ref={formRef} className={panelCls}>
          <LedgerEventForm
            meta={meta}
            title={editing ? 'Edit event' : 'Add an event'}
            submitLabel={editing ? 'Save changes' : 'Add event'}
            formKey={editing ? `edit:${editing.id}` : 'new'}
            initial={
              editing
                ? {
                    category: editing.category,
                    date: editing.date,
                    date_precision: editing.date_precision,
                    place: editing.place ?? '',
                    attributes: editing.attributes ?? {},
                  }
                : emptyDraft()
            }
            onSubmit={save}
            onCancel={editing ? () => setEditing(null) : undefined}
          />
        </div>
        {meta.interview && (
          <div className={panelCls}>
            <LedgerInterview meta={meta} onConfirm={create} />
          </div>
        )}
      </div>

      <section className={panelCls} aria-label="All events">
        <h3 className="mb-3 text-lg font-semibold">All events ({events.length})</h3>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400">No events yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-gray-400">
                <tr>
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Place</th>
                  <th className="py-2 pr-4 font-medium">Details</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const details = meta.attributes
                    .filter((a) => ev.attributes?.[a.key])
                    .map((a) => `${a.label}: ${ev.attributes[a.key]}`)
                    .join('; ');
                  return (
                    <tr key={ev.id} className="border-t border-white/10">
                      <td className="whitespace-nowrap py-2 pr-4">{formatEventDate(ev.date, ev.date_precision)}</td>
                      <td className="py-2 pr-4">{categoryLabel(labels, ev.category)}</td>
                      <td className="py-2 pr-4 text-gray-300">{ev.place ?? ''}</td>
                      <td className="py-2 pr-4 text-gray-300">{details}</td>
                      <td className="whitespace-nowrap py-2 text-right">
                        <button type="button" className="mr-2 rounded px-2 py-1 text-purple-200 hover:bg-white/10" onClick={() => startEdit(ev)}>
                          Edit
                        </button>
                        <button type="button" className="rounded px-2 py-1 text-gray-300 hover:bg-white/10" onClick={() => void remove(ev)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default LedgerSection;
