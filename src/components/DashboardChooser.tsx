/**
 * Which dashboards the portal shows (server docs/dashboards/11, 13 §4.3): the tick list of the wizard's last step,
 * used by the wizard and by the rail's "Choose dashboards" sheet. One dashboard always stays ticked (the server refuses
 * an empty list). The sheet adds "Show all", Save and Cancel; Save writes the profile fact, then every menu follows.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { saveFacts } from '../lib/profileApi';
import { track } from '../lib/events';
import {
  PORTAL_DASHBOARD_IDS,
  PORTAL_DASHBOARD_LABELS,
  PORTAL_FACT,
  isFocusedDashboard,
  portalFactValue,
  setPortalDashboards,
  type PortalDashboardId,
} from '../lib/portalDashboards';

/** the groups: the three boards, the focused dashboards, Lucky times */
export const DASHBOARD_GROUPS: Array<{ title: string; ids: PortalDashboardId[] }> = [
  { title: 'Boards', ids: ['self', 'love', 'work'] },
  { title: 'Focused dashboards', ids: PORTAL_DASHBOARD_IDS.filter(isFocusedDashboard) },
  { title: 'Timing', ids: ['lucky'] },
];

export const CHOOSER_WORDS = {
  question: 'Which dashboards do you want to see?',
  keepOne: 'Keep at least one.',
  changeLater: 'You can change this any time from Choose dashboards in the side menu.',
  title: 'Choose dashboards',
  showAll: 'Show all',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  close: 'Close',
  saveFailed: 'Your choice could not be saved. Please try again.',
} as const;

const chip = 'min-h-[44px] rounded-xl border px-3.5 py-2 text-left text-sm transition-colors';

/** the tick list; `value` in menu order. Unticking the last one does nothing. */
export default function DashboardChooser({ value, onChange, hint }: { value: readonly PortalDashboardId[]; onChange: (next: PortalDashboardId[]) => void; hint?: string }) {
  const toggle = (id: PortalDashboardId) => {
    const has = value.includes(id);
    if (has && value.length <= 1) return;
    const next = has ? value.filter((d) => d !== id) : [...value, id];
    onChange(PORTAL_DASHBOARD_IDS.filter((d) => next.includes(d)));
  };
  return (
    <fieldset data-testid="dashboards-choice" className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <legend className="mb-1 font-medium text-white/90">{CHOOSER_WORDS.question}</legend>
      <p className="mb-3 text-sm text-white/60" data-testid="dashboards-choice-hint">
        {value.length <= 1 ? CHOOSER_WORDS.keepOne : (hint ?? CHOOSER_WORDS.changeLater)}
      </p>
      <div className="space-y-3">
        {DASHBOARD_GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 text-xs uppercase tracking-wide text-white/50">{g.title}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.ids.map((id) => {
                const ticked = value.includes(id);
                const last = ticked && value.length <= 1;
                return (
                  <label
                    key={id}
                    className={`${chip} flex items-center gap-3 ${last ? 'cursor-not-allowed' : 'cursor-pointer'} ${ticked ? 'border-purple-400 bg-white/15 text-white' : 'border-white/15 bg-white/5 text-white/85 hover:bg-white/10'}`}
                  >
                    <input type="checkbox" checked={ticked} disabled={last} onChange={() => toggle(id)} className="h-4 w-4 shrink-0 accent-purple-500" />
                    <span>{PORTAL_DASHBOARD_LABELS[id]}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The rail's sheet: a dialog over the page, portalled to `document.body` (the rail is a backdrop-filter bar, which
 * would clip a fixed child). Starts from the person's list; Save writes it and closes, a failed save says so and stays.
 * Esc and Cancel discard; the caller returns focus to its button in `onClose`.
 */
export function DashboardChooserSheet({ initial, onClose }: { initial: readonly PortalDashboardId[]; onClose: () => void }) {
  const [draft, setDraft] = useState<PortalDashboardId[]>(() => PORTAL_DASHBOARD_IDS.filter((id) => initial.includes(id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('input:not([disabled]), button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const save = async () => {
    if (!draft.length || busy) return;
    setBusy(true);
    setError(null);
    const ok = await saveFacts({ [PORTAL_FACT]: portalFactValue(draft) }).catch(() => false);
    setBusy(false);
    if (!ok) {
      setError(CHOOSER_WORDS.saveFailed);
      return;
    }
    setPortalDashboards(draft);
    track('question_answer', 'sidenav', 'dashboards', { count: draft.length });
    onClose();
  };

  const all = draft.length === PORTAL_DASHBOARD_IDS.length;
  const sheet = (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" data-testid="dashboard-chooser-shade" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-chooser-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-white/15 bg-[#0d0c24] text-white shadow-2xl sm:rounded-2xl"
        data-testid="dashboard-chooser"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h2 id="dashboard-chooser-title" className="text-lg font-semibold">
            {CHOOSER_WORDS.title}
          </h2>
          <button type="button" onClick={onClose} aria-label={CHOOSER_WORDS.close} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white" data-testid="dashboard-chooser-close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <DashboardChooser value={draft} onChange={setDraft} hint="" />
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-white/10 px-4 py-3">
          {error && (
            <p role="alert" className="w-full text-sm text-rose-300" data-testid="dashboard-chooser-error">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => setDraft([...PORTAL_DASHBOARD_IDS])}
            disabled={all}
            className="mr-auto min-h-[44px] rounded-xl border border-teal-300/50 bg-teal-500/10 px-4 text-sm font-semibold text-teal-200 hover:bg-teal-500/20 disabled:opacity-40"
            data-testid="dashboard-chooser-all"
          >
            {CHOOSER_WORDS.showAll}
          </button>
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl border border-white/15 px-4 text-sm font-bold text-white/80 hover:bg-white/5" data-testid="dashboard-chooser-cancel">
            {CHOOSER_WORDS.cancel}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !draft.length}
            className="min-h-[44px] rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 text-sm font-bold text-white disabled:opacity-40"
            data-testid="dashboard-chooser-save"
          >
            {busy ? CHOOSER_WORDS.saving : CHOOSER_WORDS.save}
          </button>
        </div>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(sheet, document.body) : null;
}
