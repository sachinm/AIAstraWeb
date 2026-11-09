/**
 * Grouped chips for the one carousel (server docs/reading-engine/66 mockup §1): a small group label (Now · You · Time)
 * before its chips, the chip in focus filled, and a red count on a chip whose card changed since the last visit. In
 * `compact` mode (iPad portrait) only the group names show, the focused group with its card's name; a tap opens the
 * group's chips.
 *
 * `useSeenCounts` keeps what the person last saw per card in localStorage (wrapped in try/catch: private windows and
 * blocked storage just show no counts).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface ChipItem {
  id: string;
  label: string;
  /** new since the last visit; 0 or absent shows nothing */
  count?: number;
}

export interface ChipGroup {
  id: string;
  label: string;
  items: ChipItem[];
}

const chipCls = 'inline-flex min-h-[40px] shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60';
const onCls = 'border-transparent bg-teal-500/15 font-semibold text-teal-200';
const offCls = 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10';

function Count({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold leading-none text-white" aria-label={`${n} new`} data-testid="chip-count">
      {n}
    </span>
  );
}

export default function Chips({ groups, activeId, onSelect, compact = false, label = 'Cards', testId = 'chips' }: { groups: ChipGroup[]; activeId: string | null; onSelect: (id: string) => void; compact?: boolean; label?: string; testId?: string }) {
  const row = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const activeGroup = groups.find((g) => g.items.some((i) => i.id === activeId))?.id ?? null;

  // the chip in focus stays on screen inside the row (the row scrolls sideways only)
  useLayoutEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeId, compact, open]);

  const chip = (i: ChipItem) => (
    <button
      key={i.id}
      type="button"
      role="tab"
      aria-selected={i.id === activeId}
      onClick={() => {
        onSelect(i.id);
        setOpen(null);
      }}
      className={`${chipCls} ${i.id === activeId ? onCls : offCls}`}
      data-testid={`${testId}-${i.id}`}
    >
      {i.label}
      <Count n={i.count} />
    </button>
  );

  return (
    <div ref={row} role="tablist" aria-label={label} className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none]" data-testid={testId}>
      {groups.map((g) => {
        const total = g.items.reduce((n, i) => n + (i.count ?? 0), 0);
        if (compact && open !== g.id) {
          const active = g.items.find((i) => i.id === activeId);
          return (
            <button
              key={g.id}
              type="button"
              aria-expanded={false}
              onClick={() => setOpen(g.id)}
              className={`${chipCls} ${activeGroup === g.id ? onCls : offCls}`}
              data-testid={`${testId}-group-${g.id}`}
            >
              {g.label}
              {active && <span className="ml-1 opacity-80">· {active.label}</span>}
              <Count n={total} />
            </button>
          );
        }
        return (
          <div key={g.id} className="flex shrink-0 items-center gap-2" role="presentation">
            <span className="shrink-0 pr-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white/45" data-testid={`${testId}-label-${g.id}`}>
              {g.label}
            </span>
            {g.items.map(chip)}
          </div>
        );
      })}
    </div>
  );
}

/** What the person last saw on each card, by card id: the texts that were on it. */
type Seen = Record<string, string[]>;

function readSeen(key: string): Seen | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const j = JSON.parse(raw) as unknown;
    return j && typeof j === 'object' ? (j as Seen) : null;
  } catch {
    return null;
  }
}

function writeSeen(key: string, seen: Seen): void {
  try {
    localStorage.setItem(key, JSON.stringify(seen));
  } catch {
    /* storage blocked: counts simply do not persist */
  }
}

/**
 * Counts of what is new on each card since the last visit. `items` maps a card id to the texts on it (headline,
 * patterns). On a first visit nothing counts as new. `markSeen(id)` stores the card as seen (call it when the card is
 * in focus); its count clears.
 */
export function useSeenCounts(storageKey: string, items: Record<string, string[]>): { counts: Record<string, number>; markSeen: (id: string) => void } {
  const [baseline] = useState<Seen | null>(() => readSeen(storageKey));
  const [cleared, setCleared] = useState<Record<string, true>>({});
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // a first visit stores everything as seen, so the next visit counts only what changed
  useEffect(() => {
    if (baseline === null && Object.keys(items).length) writeSeen(storageKey, { ...items });
  }, [baseline, storageKey, items]);

  const counts: Record<string, number> = {};
  if (baseline) {
    for (const [id, texts] of Object.entries(items)) {
      if (cleared[id]) continue;
      const before = baseline[id];
      if (!before) continue;
      const n = texts.filter((t) => t && !before.includes(t)).length;
      if (n) counts[id] = n;
    }
  }

  const markSeen = useCallback(
    (id: string) => {
      const texts = itemsRef.current[id];
      if (!texts) return;
      const now = readSeen(storageKey) ?? {};
      now[id] = texts;
      writeSeen(storageKey, now);
      setCleared((c) => (c[id] ? c : { ...c, [id]: true }));
    },
    [storageKey],
  );

  return { counts, markSeen };
}
