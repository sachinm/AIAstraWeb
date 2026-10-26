import React, { useState } from 'react';
import { clarifyPlaceholder, LOCATION_CRITERION, type ClarifyView } from './readingUi';

export interface ClarifyCardProps {
  view: ClarifyView;
  busy?: boolean;
  onChip: (value: string, label: string) => void;
  onText: (text: string) => void;
  onConfirm: () => void;
  onChange: () => void;
}

/**
 * The clarify agent's card (docs/reading-engine/17): one short question with tappable options and a free-text box, or
 * the exact query to confirm. A declined reply is shown as plain text with nothing to tap.
 */
const ClarifyCard: React.FC<ClarifyCardProps> = ({ view, busy = false, onChip, onText, onConfirm, onChange }) => {
  const [text, setText] = useState('');
  if (view.type === 'declined') {
    return (
      <p data-test-id="clarify-declined" className="text-slate-100">
        {view.reply}
      </p>
    );
  }
  if (view.type === 'propose') {
    return (
      <div data-test-id="clarify-propose" className="space-y-3">
        <p className="text-slate-100">{view.exactQuery}</p>
        {view.assumed && <p className="text-sm text-slate-400">{view.assumed}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" data-test-id="clarify-confirm" disabled={busy} onClick={onConfirm} className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50">
            Yes, read it
          </button>
          <button type="button" data-test-id="clarify-change" disabled={busy} onClick={onChange} className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50">
            Change
          </button>
        </div>
      </div>
    );
  }
  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    onText(t);
  };
  return (
    <div data-test-id="clarify-card" className="space-y-3">
      {view.understanding && <p className="text-sm italic text-slate-400">{view.understanding}</p>}
      <p className="text-slate-100" data-test-id="clarify-question">
        {view.question}
      </p>
      {view.guidance && (
        <p className="text-sm text-slate-400" data-test-id="clarify-guidance">
          {view.guidance}
        </p>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Options">
        {view.chips.map((c) => (
          <button
            key={`${c.value}-${c.label}`}
            type="button"
            data-test-id="clarify-chip"
            disabled={busy}
            onClick={() => onChip(c.value, c.label)}
            className="rounded-full border border-amber-300/40 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-300/10 disabled:opacity-50"
          >
            {c.label}
          </button>
        ))}
      </div>
      {view.allowFreeText && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            data-test-id="clarify-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            placeholder={clarifyPlaceholder(view.criterion)}
            aria-label={view.criterion === LOCATION_CRITERION ? 'Where you live now' : 'Type your answer'}
            className="min-w-0 flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button type="submit" data-test-id="clarify-send" disabled={busy || !text.trim()} className="rounded-lg border border-white/20 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50">
            Send
          </button>
        </form>
      )}
    </div>
  );
};

export default ClarifyCard;
