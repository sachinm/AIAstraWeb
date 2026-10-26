import { useEffect, useState } from 'react';
import { fetchLedgerMeta, type LedgerMeta } from '../../lib/ledgerApi';

/**
 * Loads `GET /api/timeline/ledger/meta` once per page load and shares it between the nav link and the page.
 * `meta === null` after loading = feature off (404) or not reachable: the link and page stay hidden.
 */
let cached: Promise<LedgerMeta | null> | null = null;

export function loadLedgerMeta(): Promise<LedgerMeta | null> {
  if (!cached) {
    cached = fetchLedgerMeta().catch(() => {
      cached = null; // allow a retry on the next mount (e.g. after sign-in)
      return null;
    });
  }
  return cached;
}

/** Test hook. */
export function resetLedgerMetaCache(): void {
  cached = null;
}

export function useLedgerMeta(): { meta: LedgerMeta | null; loading: boolean } {
  const [state, setState] = useState<{ meta: LedgerMeta | null; loading: boolean }>({ meta: null, loading: true });
  useEffect(() => {
    let alive = true;
    loadLedgerMeta().then((meta) => {
      if (alive) setState({ meta, loading: false });
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
