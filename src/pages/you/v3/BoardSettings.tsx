/**
 * Card settings (the gear in the Self title row, doc 75): how every card opens (Read or Short), the voice (only when
 * the server writes both voices) and whether cards ask "Is this right?". Nothing else. A popover on a desktop or tablet,
 * a bottom sheet on a phone. Choices apply at once and save through the board.
 */
import { useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import type { BoardOptions } from '../../../lib/cardOptions';
import type { CardVoice } from '../../../lib/selfV3Api';
import { FACES } from './CardToolbar';
import { shownFace, type ShownFace } from './faces/FaceBody';
import { ACROSS_CHOICES, ACROSS_WORD, FACE_WIRE, FACE_WORD, VOICE_WORD, V3_WORDS, type AcrossChoice } from './words';

export interface BoardSettingsProps {
  /** the board-wide settings in force (the server's defaults with the person's changes) */
  value: BoardOptions;
  onChange: (patch: Partial<BoardOptions>) => void;
  /** Short is offered (feature.face.short) */
  shortOn?: boolean;
  /** the server writes both voices (feature.voice) */
  voiceOn?: boolean;
  /** "Is this right?" is offered (feature.confirm) */
  confirmOn?: boolean;
  phone?: boolean;
  disabled?: boolean;
  /**
   * Tablet and desktop (server docs/dashboards/13 §4.3): "Cards across: Auto · 1 · 2 · 3 · 4", kept per device by the
   * board. Offered only with `onAcross` and never on a phone.
   */
  across?: AcrossChoice;
  onAcross?: (v: AcrossChoice) => void;
}

const VOICES: readonly CardVoice[] = ['gentle', 'direct'];

const chip = 'self-v3-btn rounded-full px-3 text-[13px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60';

function Choice<T extends string>({ label, value, options, words, onPick, testId }: { label: string; value: T; options: readonly T[]; words: Record<T, string>; onPick: (v: T) => void; testId: string }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-[13px] font-bold text-white/60">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1" data-testid={testId}>
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onPick(o)} className={`${chip} ${value === o ? 'self-v3-on' : 'bg-white/5 text-white/70 hover:text-white'}`} data-testid={`${testId}-${o}`}>
            {words[o]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Switch({ label, on, onToggle, testId }: { label: string; on: boolean; onToggle: () => void; testId: string }) {
  return (
    <label className="flex min-h-[40px] cursor-pointer items-center justify-between gap-3 rounded-lg px-1 text-[15px] text-white/85">
      {label}
      <input type="checkbox" role="switch" className="h-5 w-5 accent-teal-400" checked={on} onChange={onToggle} data-testid={testId} />
    </label>
  );
}

export default function BoardSettings({ value, onChange, shortOn = true, voiceOn = false, confirmOn = true, phone = false, disabled = false, across = 'auto', onAcross }: BoardSettingsProps) {
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
  const acrossOn = !phone && !!onAcross;
  const nothing = !shortOn && !voiceOn && !confirmOn && !acrossOn;
  if (nothing) return null;
  const panel = (
    <div
      role="dialog"
      aria-label={V3_WORDS.cardSettings}
      className={
        phone
          ? 'fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0e1650] p-4 shadow-2xl'
          : 'absolute right-0 top-full z-30 mt-1 max-h-[75vh] w-[min(20rem,90vw)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0e1650] p-4 shadow-2xl [scrollbar-width:thin]'
      }
      data-testid="board-settings-panel"
    >
      <div className="grid gap-3">
        <p className="text-[15px] text-white/65">{V3_WORDS.settingsLead}</p>
        {shortOn && (
          <Choice<ShownFace> label={V3_WORDS.readAs} value={shownFace(value.face)} options={FACES} words={FACE_WORD} onPick={(f) => onChange({ face: FACE_WIRE[f] })} testId="bs-face" />
        )}
        {voiceOn && <Choice<CardVoice> label={V3_WORDS.voice} value={value.voice ?? 'gentle'} options={VOICES} words={VOICE_WORD} onPick={(voice) => onChange({ voice })} testId="bs-voice" />}
        {acrossOn && <Choice<AcrossChoice> label={V3_WORDS.cardsAcross} value={across} options={ACROSS_CHOICES} words={ACROSS_WORD} onPick={(v) => onAcross!(v)} testId="bs-across" />}
        {confirmOn && <Switch label={V3_WORDS.showConfirm} on={value.confirm} onToggle={() => onChange({ confirm: !value.confirm })} testId="bs-confirm" />}
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
