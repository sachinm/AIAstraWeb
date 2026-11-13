/**
 * Card settings (the gear in the Self title row): how every card reads by default. A popover on a desktop or tablet,
 * a bottom sheet on a phone. Choices apply at once and save through the board (optimistic, debounced). A card that
 * was changed on its own keeps its choice until "Apply to all cards" clears it.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Settings } from 'lucide-react';
import { CARD_FACES, CARD_GROUP_BYS, CARD_TOOLS, type BoardOptions, type CardTool } from '../../../lib/cardOptions';
import { FACE_WORD, GROUPS_AS_WORD, GROUP_BY_WORD, START_WORD, TOOL_WORD, V3_WORDS } from './words';

export interface BoardSettingsProps {
  /** the board-wide settings in force (the server's defaults with the person's changes) */
  value: BoardOptions;
  onChange: (patch: Partial<BoardOptions>) => void;
  /** how many cards keep settings of their own */
  ownCount: number;
  onApplyAll: () => void;
  phone?: boolean;
  disabled?: boolean;
}

const chip = 'self-v3-btn rounded-full px-3 text-[13px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/50">{label}</p>
      {children}
    </div>
  );
}

function Choice<T extends string>({ label, value, options, words, onPick, testId }: { label: string; value: T; options: readonly T[]; words: Record<T, string>; onPick: (v: T) => void; testId: string }) {
  return (
    <Row label={label}>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1" data-testid={testId}>
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onPick(o)} className={`${chip} ${value === o ? 'self-v3-on' : 'bg-white/5 text-white/70 hover:text-white'}`} data-testid={`${testId}-${o}`}>
            {words[o]}
          </button>
        ))}
      </div>
    </Row>
  );
}

function Switch({ label, on, onToggle, testId }: { label: string; on: boolean; onToggle: () => void; testId: string }) {
  return (
    <label className="flex min-h-[40px] cursor-pointer items-center justify-between gap-3 rounded-lg px-1 text-sm text-white/85">
      {label}
      <input type="checkbox" role="switch" className="h-5 w-5 accent-teal-400" checked={on} onChange={onToggle} data-testid={testId} />
    </label>
  );
}

export default function BoardSettings({ value, onChange, ownCount, onApplyAll, phone = false, disabled = false }: BoardSettingsProps) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent) => !phone && box.current && !box.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open, phone]);
  const toggleTool = (t: CardTool) => onChange({ tools: CARD_TOOLS.filter((x) => (x === t ? !value.tools.includes(t) : value.tools.includes(x))) });
  const panel = (
    <div
      role="dialog"
      aria-label={V3_WORDS.cardSettings}
      className={
        phone
          ? 'fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0e1650] p-4 shadow-2xl'
          : 'absolute right-0 top-full z-30 mt-1 max-h-[75vh] w-[min(22rem,90vw)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0e1650] p-4 shadow-2xl [scrollbar-width:thin]'
      }
      data-testid="board-settings-panel"
    >
      <div className="grid gap-3">
        <p className="text-sm text-white/65">{V3_WORDS.settingsLead}</p>
        <Choice label={V3_WORDS.readAs} value={value.face} options={CARD_FACES} words={FACE_WORD} onPick={(face) => onChange({ face })} testId="bs-face" />
        <Row label={V3_WORDS.openTools}>
          <div role="group" aria-label={V3_WORDS.openTools} className="flex flex-wrap gap-1" data-testid="bs-tools">
            {CARD_TOOLS.map((t) => (
              <button key={t} type="button" aria-pressed={value.tools.includes(t)} onClick={() => toggleTool(t)} className={`${chip} ${value.tools.includes(t) ? 'self-v3-on' : 'bg-white/5 text-white/70 hover:text-white'}`} data-testid={`bs-tool-${t}`}>
                {TOOL_WORD[t]}
              </button>
            ))}
          </div>
        </Row>
        <Choice label={V3_WORDS.groupBy} value={value.groupBy} options={CARD_GROUP_BYS} words={GROUP_BY_WORD} onPick={(groupBy) => onChange({ groupBy })} testId="bs-groupby" />
        <Choice label={V3_WORDS.groupsAs} value={value.groupsAs} options={['swipe', 'accordion'] as const} words={GROUPS_AS_WORD} onPick={(groupsAs) => onChange({ groupsAs })} testId="bs-groupsas" />
        <Choice label={V3_WORDS.startCards} value={value.start} options={['short', 'full'] as const} words={START_WORD} onPick={(start) => onChange({ start })} testId="bs-start" />
        <div>
          <Switch label={V3_WORDS.showConfirm} on={value.confirm} onToggle={() => onChange({ confirm: !value.confirm })} testId="bs-confirm" />
          <Switch label={V3_WORDS.turnAnimation} on={value.motion} onToggle={() => onChange({ motion: !value.motion })} testId="bs-motion" />
        </div>
        <div className="border-t border-white/10 pt-3">
          <p className="mb-2 text-sm text-white/65" data-testid="bs-own-count">
            {ownCount > 0 ? V3_WORDS.ownCount(ownCount) : V3_WORDS.allFollow}
          </p>
          <button type="button" onClick={onApplyAll} disabled={ownCount === 0} className="self-v3-btn w-full rounded-full border border-white/20 bg-white/5 px-4 text-sm font-semibold text-white/90 hover:bg-white/10 disabled:opacity-40" data-testid="bs-apply-all">
            {V3_WORDS.applyAll}
          </button>
        </div>
        {phone && (
          <button type="button" onClick={() => setOpen(false)} className="self-v3-btn w-full rounded-full px-4 text-sm font-semibold text-purple-300" data-testid="bs-close">
            {V3_WORDS.done}
          </button>
        )}
      </div>
    </div>
  );
  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        aria-label={V3_WORDS.cardSettings}
        title={V3_WORDS.cardSettings}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="self-v3-btn inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/85 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 disabled:opacity-40"
        data-testid="board-settings-open"
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && panel}
    </div>
  );
}
