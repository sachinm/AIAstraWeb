import React, { useEffect, useRef, useState } from 'react';
import { Loader2, PanelLeftOpen, PanelRightOpen, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import KundliDataCard from './KundliDataCard';
import { fetchKundliDisplayData, KundliDisplayDataResponse } from '../UserData';

interface ChatRightSidebarProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const asText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** The name and quarter from the stored birth star, without its clock times ("Kaettai  (Me) Quarter-3 21:29..."). */
export function birthStar(value: unknown): string {
  const text = asText(value);
  const name = text.split('(')[0].trim();
  const quarter = /Quarter-(\d)/.exec(text)?.[1];
  return quarter ? `${name}, Quarter ${quarter}` : name;
}

/** Display names for the stored sign abbreviations. A label only: the sign itself comes from the stored chart. */
const RASI_NAMES: Record<string, string> = {
  Ar: 'Aries', Ta: 'Taurus', Ge: 'Gemini', Cn: 'Cancer', Le: 'Leo', Vi: 'Virgo',
  Li: 'Libra', Sc: 'Scorpio', Sg: 'Sagittarius', Cp: 'Capricorn', Aq: 'Aquarius', Pi: 'Pisces',
};

/** Same formats as the profile page; anything unexpected is shown as stored. */
export function displayDate(value: unknown): string {
  const text = asText(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : text;
}

export function displayTime(value: unknown): string {
  const text = asText(value);
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  if (!m) return text;
  const hour = Number(m[1]);
  return `${hour % 12 || 12}:${m[2]} ${hour < 12 ? 'AM' : 'PM'}`;
}

const ChatRightSidebar: React.FC<ChatRightSidebarProps> = ({ isOpen, onOpenChange }) => {
  const { t } = useTranslation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<KundliDisplayDataResponse | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        typeof window !== 'undefined' &&
        window.innerWidth < 768 &&
        isOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        onOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen || hasLoadedOnce) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchKundliDisplayData();
        if (cancelled) return;
        setData(result);
        setHasLoadedOnce(true);
      } catch (err) {
        if (cancelled) return;
        // the raw message ("Failed to fetch") means nothing to a reader; the console keeps it
        console.debug('fetchKundliDisplayData failed', err instanceof Error ? err.message : String(err));
        setError(t('sidebar.loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, hasLoadedOnce, attempt, t]);

  const handleToggle = () => {
    onOpenChange(!isOpen);
  };

  const biodata = (data?.biodata ?? {}) as Record<string, unknown>;
  const lagna = Array.isArray(data?.d1)
    ? (data.d1 as Record<string, unknown>[]).find((row) => row?.body === 'Lagna')
    : undefined;
  const lagnaStar = asText(lagna?.nakshatra);
  const lagnaPada = asText(lagna?.pada);
  const facts: [string, string][] = [
    [t('sidebar.date'), displayDate(biodata.date)],
    [t('sidebar.time'), displayTime(biodata.time)],
    [t('sidebar.place'), asText(biodata.place_name)],
    [t('sidebar.birthStar'), birthStar(biodata.nakshatra)],
    [t('sidebar.lagna'), RASI_NAMES[asText(lagna?.rasi)] ?? asText(lagna?.rasi)],
    [t('sidebar.lagnaStar'), lagnaStar && lagnaPada ? t('sidebar.starPada', { star: lagnaStar, pada: lagnaPada }) : lagnaStar],
  ];

  return (
    <>
      {isOpen && typeof window !== 'undefined' && window.innerWidth < 768 && (
        <div
          className="absolute inset-0 bg-black/60 z-20 md:hidden"
          data-test-id="chat-right-sidebar-overlay"
          onClick={() => onOpenChange(false)}
        />
      )}

      <div
        ref={sidebarRef}
        data-test-id="chat-right-sidebar"
        className={`absolute inset-y-0 right-0 md:relative md:inset-auto z-30 h-full shrink-0 transition-all duration-300 ease-in-out bg-black/40 border-l border-white/10
          ${
            isOpen
              ? 'translate-x-0 w-[85vw] md:w-[360px] max-w-[360px]'
              : 'translate-x-full w-[85vw] md:translate-x-0 md:w-10'
          }
        `}
      >
        <div className="flex h-full">
          {/* Collapsed rail */}
          <div
            className="hidden md:flex flex-col items-center gap-4 p-3 w-10 bg-black/60 border-l border-white/10"
            data-test-id="chat-right-sidebar-rail"
          >
            <button
              onClick={handleToggle}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              aria-label={isOpen ? 'Collapse right sidebar' : 'Expand right sidebar'}
            >
              {isOpen ? (
                <PanelRightOpen className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Content */}
          {isOpen && (
            <div className="flex-1 bg-black/80 px-3 py-4 overflow-y-auto">
              <div className="mb-3">
                <h2 className="text-xs font-semibold text-white tracking-wide">
                  {t('sidebar.title')}
                </h2>
              </div>

              {loading && (
                <div
                  className="flex items-center justify-center py-6"
                  data-test-id="chat-right-sidebar-loading"
                >
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin mr-2" />
                  <span className="text-xs text-gray-300">
                    {t('sidebar.loading')}
                  </span>
                </div>
              )}

              {error && !loading && (
                <div className="flex items-start gap-2 py-3" role="alert">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-[2px] shrink-0" />
                  <div>
                    <p className="text-[11px] text-red-200">
                      {error}
                    </p>
                    <button
                      type="button"
                      onClick={() => setAttempt((n) => n + 1)}
                      className="mt-2 rounded-lg bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
                    >
                      {t('sidebar.retry')}
                    </button>
                  </div>
                </div>
              )}

              {!loading && !error && (
                <div>
                  <dl className="mb-3 space-y-2 text-xs" data-test-id="chat-right-sidebar-facts">
                    {facts.map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[10px] uppercase tracking-wide text-gray-400">{label}</dt>
                        <dd className="text-gray-100">{value || t('sidebar.notYet')}</dd>
                      </div>
                    ))}
                  </dl>
                  {/* the server sends these only to an account with the research flag */}
                  {data?.research && (
                    <>
                      <KundliDataCard title="Biodata" data={data.biodata} />
                      <KundliDataCard title="D1" data={data.d1} />
                      <KundliDataCard title="D7" data={data.d7} />
                      <KundliDataCard title="D9" data={data.d9} />
                      <KundliDataCard title="D10" data={data.d10} />
                      <KundliDataCard title="Vimsottari Dasa" data={data.vimsottari_dasa} tableKind="vimsottari" />
                      <KundliDataCard title="Narayana Dasa" data={data.narayana_dasa} tableKind="narayana" />
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ChatRightSidebar;
