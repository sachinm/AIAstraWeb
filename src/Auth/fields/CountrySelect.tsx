import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { COUNTRIES, countryName } from './countries';

interface Props {
  id: string;
  /** ISO 3166-1 alpha-2 code, or '' when nothing is chosen. */
  value: string;
  onChange: (code: string) => void;
  onBlur?: () => void;
  error?: string;
  describedBy?: string;
}

/** Searchable country list. Typing filters it; the value is the alpha-2 code. */
const CountrySelect = forwardRef<HTMLInputElement, Props>(function CountrySelect(
  { id, value, onChange, onBlur, error, describedBy },
  ref
) {
  const [query, setQuery] = useState(countryName(value));
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // keep the text in step when the value is set from outside (saved draft, default)
  useEffect(() => {
    setQuery(countryName(value));
  }, [value]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === countryName(value).toLowerCase()) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q);
  }, [query, value]);

  const choose = (code: string) => {
    onChange(code);
    setQuery(countryName(code));
    setOpen(false);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (wrapRef.current?.contains(e.relatedTarget as Node | null)) return;
    setOpen(false);
    const exact = COUNTRIES.find((c) => c.name.toLowerCase() === query.trim().toLowerCase());
    if (exact) {
      if (exact.code !== value) onChange(exact.code);
      setQuery(exact.name);
    } else if (query.trim() === '') {
      if (value) onChange('');
    } else {
      // text that is not a country: fall back to the last real choice
      setQuery(countryName(value));
    }
    onBlur?.();
  };

  return (
    <div className="relative" ref={wrapRef} onBlur={handleBlur}>
      <input
        ref={ref}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        autoComplete="off"
        value={query}
        placeholder="Start typing a country"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' && open && matches.length > 0 && query.trim() !== countryName(value)) {
            e.preventDefault();
            choose(matches[0].code);
          }
        }}
        className={`w-full bg-white/10 border ${error ? 'border-red-500' : 'border-white/20'} rounded-lg pl-4 pr-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label="Countries"
          className="absolute z-20 left-0 right-0 mt-2 max-h-60 overflow-auto rounded-xl border border-white/20 bg-slate-900/95 backdrop-blur-md py-1 shadow-2xl"
        >
          {matches.length === 0 && <li className="px-4 py-2 text-sm text-gray-400">No country matches.</li>}
          {matches.map((c) => (
            <li
              key={c.code}
              role="option"
              aria-selected={c.code === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(c.code)}
              className={`px-4 py-2 text-sm cursor-pointer text-white hover:bg-purple-500/40 ${c.code === value ? 'bg-purple-600/40' : ''}`}
            >
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

export default CountrySelect;
