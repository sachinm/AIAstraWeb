/**
 * The lens switcher on the Love and Work boards (server docs/dashboards/10 §4.4, W3). Tablet and desktop: a segmented
 * bar of the board's four lenses in the head row. Phone: the board title in the app header reads "Love · Dating ▾" and
 * opens a sheet of the four lenses, so it takes no card height (docs/dashboards/09). Switching never leaves the page.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Sheet from '../../you/v2/Sheet';

export interface LensOption {
  id: string;
  title: string;
}

/** the segmented bar (tablet, desktop) */
export function LensTabs({ lenses, active, onPick, label }: { lenses: LensOption[]; active: string | null; onPick: (id: string) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex shrink-0 flex-wrap rounded-full border border-white/10 bg-white/5 p-0.5" data-testid="lens-tabs">
      {lenses.map((l) => (
        <button
          key={l.id}
          type="button"
          role="tab"
          aria-selected={active === l.id}
          onClick={() => onPick(l.id)}
          className={`min-h-[36px] rounded-full px-3.5 text-[13px] font-semibold ${active === l.id ? 'bg-teal-500/20 text-teal-200' : 'text-white/65 hover:text-white'}`}
          data-testid={`lens-${l.id}`}
        >
          {l.title}
        </button>
      ))}
    </div>
  );
}

/** the phone title in the app header: "Love · Dating ▾", opening a sheet of the lenses */
export function LensTitleButton({
  boardTitle,
  lenses,
  active,
  onPick,
  label,
}: {
  boardTitle: string;
  lenses: LensOption[];
  active: string | null;
  onPick: (id: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const current = lenses.find((l) => l.id === active);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex min-w-0 items-center gap-1 truncate pl-1 text-base font-bold text-white"
        data-testid="self-phone-title"
      >
        <span className="truncate">
          {boardTitle}
          {current ? ` · ${current.title}` : ''}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-white/70" aria-hidden="true" />
      </button>
      {open && (
        <Sheet title={label} onClose={() => setOpen(false)} testId="lens-sheet">
          <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
            {lenses.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={active === l.id}
                onClick={() => {
                  setOpen(false);
                  onPick(l.id);
                }}
                className={`min-h-[48px] rounded-xl border px-4 text-left text-[15px] font-semibold ${active === l.id ? 'border-teal-300/40 bg-teal-500/15 text-teal-100' : 'border-white/10 bg-white/5 text-white/85'}`}
                data-testid={`lens-option-${l.id}`}
              >
                {l.title}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
