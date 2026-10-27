import { forwardRef, useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { MIN_YEAR, isoOf, isoToTyped, parseTypedDate, todayISO } from './dateUtils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const YEARS_PER_PAGE = 12;
const JUMPS = [10, 20, 30, 40];

interface Props {
  id: string;
  /** What is in the text box (DD/MM/YYYY while typing). */
  text: string;
  onTextChange: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  describedBy?: string;
}

/**
 * Date of birth: a text box with the format spelled out, and a calendar button. The calendar opens on a
 * year grid (12 years a page, with -10 y to -40 y jumps), then months, then days, so 1985 is a few taps away.
 */
const BirthDateField = forwardRef<HTMLInputElement, Props>(function BirthDateField(
  { id, text, onTextChange, onBlur, error, describedBy },
  ref
) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'years' | 'months' | 'days'>('years');
  const now = new Date();
  const thisYear = now.getFullYear();
  const iso = parseTypedDate(text);
  const [viewYear, setViewYear] = useState(iso ? Number(iso.slice(0, 4)) : thisYear - 30);
  const [viewMonth, setViewMonth] = useState(iso ? Number(iso.slice(5, 7)) - 1 : 0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      if (iso) {
        setViewYear(Number(iso.slice(0, 4)));
        setViewMonth(Number(iso.slice(5, 7)) - 1);
        setView('days');
      } else {
        setView('years');
      }
    }
    setOpen(!open);
  };

  const clampYear = (y: number) => Math.min(thisYear, Math.max(MIN_YEAR, y));
  const pageStart = Math.floor((viewYear - MIN_YEAR) / YEARS_PER_PAGE) * YEARS_PER_PAGE + MIN_YEAR;
  const today = todayISO(now);

  const first = new Date(viewYear, viewMonth, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const nav = 'p-2 rounded-lg text-purple-200 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed';
  const cell = 'py-2 rounded-lg text-sm text-white hover:bg-purple-500/40 disabled:opacity-30 disabled:cursor-not-allowed';
  const link = 'text-sm text-purple-200 underline underline-offset-2';

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onBlur={onBlur}
          placeholder="DD/MM/YYYY"
          autoComplete="bday"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`w-full bg-white/10 border ${error ? 'border-red-500' : 'border-white/20'} rounded-lg pl-4 pr-12 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
        />
        <button
          type="button"
          onClick={toggle}
          aria-label="Open calendar"
          aria-expanded={open}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-gray-300 hover:text-white"
        >
          <Calendar className="w-5 h-5" />
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Choose your date of birth"
          className="absolute z-20 left-0 right-0 mt-2 rounded-xl border border-white/20 bg-slate-900/95 backdrop-blur-md p-3 shadow-2xl"
        >
          {view === 'years' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  className={nav}
                  aria-label="Earlier years"
                  disabled={pageStart <= MIN_YEAR}
                  onClick={() => setViewYear(clampYear(pageStart - YEARS_PER_PAGE))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-200">
                  {pageStart} to {Math.min(thisYear, pageStart + YEARS_PER_PAGE - 1)}
                </span>
                <button
                  type="button"
                  className={nav}
                  aria-label="Later years"
                  disabled={pageStart + YEARS_PER_PAGE > thisYear}
                  onClick={() => setViewYear(clampYear(pageStart + YEARS_PER_PAGE))}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {JUMPS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setViewYear(clampYear(viewYear - n))}
                    className="px-2 py-1 rounded-full text-xs border border-white/20 text-purple-200 hover:bg-white/10"
                  >
                    {`−${n} y`}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: YEARS_PER_PAGE }, (_, i) => pageStart + i).map((y) => (
                  <button
                    key={y}
                    type="button"
                    disabled={y > thisYear}
                    onClick={() => {
                      setViewYear(y);
                      setView('months');
                    }}
                    className={cell}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === 'months' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <button type="button" className={link} onClick={() => setView('years')}>
                  {viewYear}
                </button>
                <span className="text-xs text-gray-400">Choose a month</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {MONTHS.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    disabled={viewYear === thisYear && i > now.getMonth()}
                    onClick={() => {
                      setViewMonth(i);
                      setView('days');
                    }}
                    className={cell}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === 'days' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <button type="button" className={link} onClick={() => setView('years')}>
                  {viewYear}
                </button>
                <button type="button" className={link} onClick={() => setView('months')}>
                  {MONTHS[viewMonth]}
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
                {WEEKDAYS.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: lead }, (_, i) => (
                  <span key={`b${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                  const v = isoOf(viewYear, viewMonth + 1, d);
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={v > today}
                      aria-label={`${d} ${MONTHS[viewMonth]} ${viewYear}`}
                      onClick={() => {
                        onTextChange(isoToTyped(v));
                        setOpen(false);
                      }}
                      className={`${cell} ${v === iso ? 'bg-purple-600' : ''}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default BirthDateField;
