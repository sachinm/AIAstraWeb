import React, { useEffect, useRef, useState } from 'react';
import { Loader2, PanelLeftOpen, PanelRightOpen, AlertCircle } from 'lucide-react';
import KundliDataCard from './KundliDataCard';
import { fetchKundliDisplayData, KundliDisplayDataResponse } from '../UserData';

interface ChatRightSidebarProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const ChatRightSidebar: React.FC<ChatRightSidebarProps> = ({ isOpen, onOpenChange }) => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<KundliDisplayDataResponse | null>(null);

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
        setError(err instanceof Error ? err.message : 'Failed to load Kundli data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, hasLoadedOnce]);

  const handleToggle = () => {
    onOpenChange(!isOpen);
  };

  const displayData = data ?? {
    success: false,
    biodata: null,
    d1: null,
    d7: null,
    d9: null,
    d10: null,
    vimsottari_dasa: null,
    narayana_dasa: null,
  };

  return (
    <>
      {isOpen && typeof window !== 'undefined' && window.innerWidth < 768 && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          data-test-id="chat-right-sidebar-overlay"
          onClick={() => onOpenChange(false)}
        />
      )}

      <div
        ref={sidebarRef}
        data-test-id="chat-right-sidebar"
        className={`fixed right-0 md:relative md:right-auto z-50 h-full transition-all duration-300 ease-in-out bg-black/40 border-l border-white/10
          ${
            isOpen
              ? 'translate-x-0 w-[60vw] md:w-[60vw] max-w-2xl'
              : 'translate-x-full w-[60vw] md:translate-x-0 md:w-10'
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
                  Kundli Snapshots
                </h2>
                <p className="text-[10px] text-gray-400">
                  Compact view of your biodata and key charts.
                </p>
              </div>

              {loading && (
                <div
                  className="flex items-center justify-center py-6"
                  data-test-id="chat-right-sidebar-loading"
                >
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin mr-2" />
                  <span className="text-xs text-gray-300">
                    Loading your Kundli tables…
                  </span>
                </div>
              )}

              {error && !loading && (
                <div className="flex items-start gap-2 py-3">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-[2px]" />
                  <p className="text-[11px] text-red-200">
                    {error}
                  </p>
                </div>
              )}

              {!loading && !error && (
                <div>
                  <KundliDataCard title="Biodata" data={displayData.biodata} />
                  <KundliDataCard title="D1" data={displayData.d1} />
                  <KundliDataCard title="D7" data={displayData.d7} />
                  <KundliDataCard title="D9" data={displayData.d9} />
                  <KundliDataCard title="D10" data={displayData.d10} />
                  <KundliDataCard
                    title="Vimsottari Dasa"
                    data={displayData.vimsottari_dasa}
                    tableKind="vimsottari"
                  />
                  <KundliDataCard
                    title="Narayana Dasa"
                    data={displayData.narayana_dasa}
                    tableKind="narayana"
                  />
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
